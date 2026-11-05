import { timingSafeEqual } from "crypto";
import { FastifyInstance } from "fastify";
import { config } from "../config";
import { prisma } from "../db";
import { runAgent } from "../services/ai";
import { sendText } from "../services/evolution";
import { bump, getUsage } from "../services/usage";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function webhookRoutes(app: FastifyInstance) {
  // Na Evolution: URL /webhooks/evolution, evento MESSAGES_UPSERT, header x-webhook-secret
  app.post("/webhooks/evolution", async (req, reply) => {
    const secret = String(req.headers["x-webhook-secret"] ?? "");
    if (!same(secret, config.webhookSecret)) return reply.code(401).send({ error: "não autorizado" });
    reply.send({ ok: true });

    try {
      const body: any = req.body;
      if (String(body.event ?? "").toLowerCase().replace("_", ".") !== "messages.upsert") return;
      const { key, pushName, message } = body.data ?? {};
      if (!key || key.fromMe || key.remoteJid?.endsWith("@g.us")) return;
      const text = message?.conversation ?? message?.extendedTextMessage?.text;
      if (!text) return;

      const ws = await prisma.workspace.findUnique({ where: { evolutionInstance: body.instance } });
      if (!ws) return;
      const usage = await getUsage(ws.id);
      if (usage.messages >= ws.monthlyMsgLimit) return; // limite mensal do workspace

      const contact = await prisma.contact.upsert({
        where: { workspaceId_jid: { workspaceId: ws.id, jid: key.remoteJid } },
        update: {},
        create: { workspaceId: ws.id, jid: key.remoteJid, phone: key.remoteJid.split("@")[0], name: pushName ?? null },
      });
      await prisma.message.create({ data: { contactId: contact.id, direction: "IN", sender: "CONTACT", text, externalId: key.id } });
      await bump(ws.id, "messages");

      if (!ws.aiEnabled || contact.botPaused || usage.aiCalls >= ws.monthlyAiLimit) return;
      const answer = await runAgent(ws, contact.id);
      if (answer) {
        await sendText(body.instance, key.remoteJid, answer);
        await prisma.message.create({ data: { contactId: contact.id, direction: "OUT", sender: "BOT", text: answer } });
        await bump(ws.id, "messages");
      }
    } catch (err) {
      app.log.error({ err: (err as Error).message }, "erro no webhook"); // nunca logar corpo nem chaves
    }
  });
}
