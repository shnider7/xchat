import { createHmac, timingSafeEqual } from "crypto";
import { FastifyInstance } from "fastify";
import { Workspace } from "@prisma/client";
import { prisma } from "../db";
import { runAgent } from "../services/ai";
import { decrypt } from "../services/crypto";
import { Ev, commentReply, handleEvent } from "../services/flow";
import { Ig, fetchProfile, replyToComment, sendDM, sendPrivateReply } from "../services/instagram";
import { bump, getUsage } from "../services/usage";

// A Meta assina cada envio (X-Hub-Signature-256) com o App Secret: sem a assinatura certa, nada é processado.
function validSig(raw: string, header?: string) {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const exp = createHmac("sha256", secret).update(raw).digest("hex"), got = header.slice(7);
  return got.length === exp.length && timingSafeEqual(Buffer.from(got), Buffer.from(exp));
}

async function upsertContact(ws: Workspace, ig: Ig, igsid: string, channel: string, source: string, detail: string, username?: string) {
  const jid = `ig:${igsid}`;
  const found = await prisma.contact.findUnique({ where: { workspaceId_jid: { workspaceId: ws.id, jid } } });
  if (found) return found;
  const prof: any = username ? { username } : await fetchProfile(ig, igsid);
  return prisma.contact.create({ data: { workspaceId: ws.id, jid, channel: channel as any, name: prof?.name ?? prof?.username ?? null, source, sourceDetail: detail.slice(0, 200) || null } });
}
const store = async (contactId: string, direction: "IN" | "OUT", sender: "CONTACT" | "BOT", text: string, externalId?: string) =>
  prisma.message.create({ data: { contactId, direction, sender, text, externalId } });

async function onMessage(ws: Workspace, ig: Ig, m: any) {
  const msg = m.message, igsid = String(m.sender.id);
  const text: string = msg.text ?? msg.quick_reply?.payload ?? "";
  const mention = (msg.attachments ?? []).find((a: any) => a.type === "story_mention");
  const story = msg.reply_to?.story;
  if (!text && !mention) return;
  const kind: Ev["kind"] = mention ? "story_mention" : story ? "story_reply" : "dm";
  const usage = await getUsage(ws.id);
  if (usage.messages >= ws.monthlyMsgLimit) return;
  const contact = await upsertContact(ws, ig, igsid, "INSTAGRAM_DM", kind, story?.url ?? mention?.payload?.url ?? "");
  if (msg.mid && (await prisma.message.findFirst({ where: { contactId: contact.id, externalId: msg.mid } }))) return; // reenvio da Meta
  await store(contact.id, "IN", "CONTACT", text || "(menção em story)", msg.mid);
  await bump(ws.id, "messages");
  if (contact.botPaused) return; // humano no controle

  let replies = (await handleEvent(ws, contact, text, { kind, text }))?.replies ?? null;
  if (!replies && ws.aiEnabled && usage.aiCalls < ws.monthlyAiLimit) { const a = await runAgent(ws, contact.id); replies = a ? [a] : null; }
  for (const r of replies ?? []) { await sendDM(ig, igsid, r); await store(contact.id, "OUT", "BOT", r); await bump(ws.id, "messages"); }
}

async function onComment(ws: Workspace, ig: Ig, v: any) {
  if (!v?.id || !v.from?.id || String(v.from.id) === ig.igId || v.parent_id) return; // ignora o próprio perfil e respostas (evita laço)
  const text = String(v.text ?? "");
  const usage = await getUsage(ws.id);
  if (usage.messages >= ws.monthlyMsgLimit) return;
  const contact = await upsertContact(ws, ig, String(v.from.id), "INSTAGRAM_COMMENT", "comment", text, v.from.username);
  if (await prisma.message.findFirst({ where: { contactId: contact.id, externalId: String(v.id) } })) return;
  await store(contact.id, "IN", "CONTACT", text, String(v.id));
  await bump(ws.id, "messages");
  if (contact.botPaused) return;

  const r = await handleEvent(ws, contact, text, { kind: "comment", text, postId: v.media?.id });
  if (!r) return; // nenhum chatbot com gatilho de comentário combinou
  const pub = await commentReply(ws, r.graph, text);
  if (pub) await replyToComment(ig, String(v.id), pub).catch(() => {});
  // A Meta permite UMA resposta privada por comentário: junta tudo em uma mensagem. Depois disso a conversa segue quando a pessoa responder.
  const dm = r.replies.join("\n\n");
  if (dm) { await sendPrivateReply(ig, String(v.id), dm); await store(contact.id, "OUT", "BOT", dm); await bump(ws.id, "messages"); }
}

async function handleEntry(entry: any) {
  const conn = await prisma.channelConnection.findFirst({ where: { type: "INSTAGRAM", externalId: String(entry.id) } });
  if (!conn) return;
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: conn.workspaceId } });
  const owner = ws.ownerId ? await prisma.user.findUnique({ where: { id: ws.ownerId }, select: { active: true } }) : null;
  if (owner && !owner.active) return; // conta desativada pelo admin: bots e IA ficam parados
  const ig: Ig = { igId: conn.externalId, token: decrypt(conn.tokenEnc) };
  for (const m of entry.messaging ?? []) if (m.message && !m.message.is_echo && String(m.sender?.id) !== ig.igId) await onMessage(ws, ig, m);
  for (const c of entry.changes ?? []) if (c.field === "comments") await onComment(ws, ig, c.value);
}

export async function instagramWebhookRoutes(app: FastifyInstance) {
  // guarda o corpo bruto para conferir a assinatura (vale só para as rotas deste plugin)
  app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
    (req as any).rawBody = body;
    try { done(null, JSON.parse(body as string)); } catch (e: any) { e.statusCode = 400; done(e, undefined); }
  });

  // Verificação do webhook (a Meta chama uma vez ao cadastrar a URL)
  app.get("/webhooks/instagram", async (req, reply) => {
    const q = req.query as any;
    if (q["hub.mode"] === "subscribe" && process.env.META_VERIFY_TOKEN && q["hub.verify_token"] === process.env.META_VERIFY_TOKEN) return reply.type("text/plain").send(q["hub.challenge"]);
    return reply.code(403).send("forbidden");
  });

  app.post("/webhooks/instagram", { config: { rateLimit: { max: 3000, timeWindow: "1 minute" } } }, async (req, reply) => {
    if (!validSig((req as any).rawBody ?? "", req.headers["x-hub-signature-256"] as string)) return reply.code(401).send({ error: "assinatura inválida" });
    reply.send({ ok: true }); // responde logo; processa em seguida
    for (const entry of (req.body as any)?.entry ?? []) {
      try { await handleEntry(entry); } catch (e) { app.log.error({ err: (e as Error).message }, "erro no webhook do Instagram"); } // nunca loga corpo nem token
    }
  });
}
