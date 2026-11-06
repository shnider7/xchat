import Anthropic from "@anthropic-ai/sdk";
import { Contact, Prisma, Workspace } from "@prisma/client";
import { prisma } from "../db";
import { salvarLead } from "./ai";
import { decrypt } from "./crypto";
import { bump, getUsage } from "./usage";

export type Node = {
  id: string; type: "message" | "question" | "options" | "ai" | "lead";
  text?: string; save?: string; options?: { label: string; goto?: string }[]; prompt?: string; turns?: number;
};
export type State = { idx: number; vars: Record<string, string>; wait?: "answer" | "ai"; aiTurns?: number; done?: boolean };
export type Msg = { role: "user" | "assistant"; content: string };
type Ctx = { history: Msg[]; ai: (prompt: string, msgs: Msg[]) => Promise<string | null>; lead: (v: Record<string, string>) => Promise<void> };

const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");
const menu = (n: Node, v: Record<string, string>) =>
  [fill(n.text ?? "Escolha uma opção:", v), ...(n.options ?? []).map((o, i) => `${i + 1}. ${o.label}`)].join("\n");

// Motor do chatbot: passos em ordem; "options" pode desviar (goto); "ai" deixa a IA responder por N mensagens
export async function run(nodes: Node[], st: State, input: string | null, ctx: Ctx) {
  const s: State = { ...st, vars: { ...st.vars } };
  const replies: string[] = [];

  if (input !== null && s.wait) {
    const n = nodes[s.idx];
    if (s.wait === "answer" && n.type === "question") {
      if (n.save) s.vars[n.save] = input.trim();
      s.wait = undefined; s.idx++;
    } else if (s.wait === "answer" && n.type === "options") {
      const t = input.trim().toLowerCase();
      const i = (n.options ?? []).findIndex((o, k) => t === String(k + 1) || t === o.label.toLowerCase());
      if (i < 0) return { replies: ["Não entendi. " + menu(n, s.vars)], state: s };
      const o = n.options![i];
      if (n.save) s.vars[n.save] = o.label;
      const gi = o.goto ? nodes.findIndex((x) => x.id === o.goto) : -1;
      s.wait = undefined; s.idx = gi >= 0 ? gi : s.idx + 1;
    } else if (s.wait === "ai") {
      const out = await ctx.ai(fill(n.prompt ?? "", s.vars), [...ctx.history, { role: "user", content: input }]);
      replies.push(out ?? "No momento não consigo responder. Já já retornamos.");
      s.aiTurns = (s.aiTurns ?? 0) + 1;
      if (s.aiTurns < (n.turns ?? 1)) return { replies, state: s };
      s.wait = undefined; s.aiTurns = 0; s.idx++;
    }
  }

  for (let guard = 0; guard < 30 && s.idx < nodes.length && !s.wait; guard++) {
    const n = nodes[s.idx];
    if (n.type === "message") { replies.push(fill(n.text ?? "", s.vars)); s.idx++; }
    else if (n.type === "question") { replies.push(fill(n.text ?? "", s.vars)); s.wait = "answer"; }
    else if (n.type === "options") { replies.push(menu(n, s.vars)); s.wait = "answer"; }
    else if (n.type === "ai") { if (n.text) replies.push(fill(n.text, s.vars)); s.wait = "ai"; s.aiTurns = 0; }
    else if (n.type === "lead") { await ctx.lead(s.vars); s.idx++; }
  }
  if (s.idx >= nodes.length && !s.wait) s.done = true;
  return { replies, state: s };
}

// IA com a chave do próprio cliente (BYOK), respeitando o limite mensal
export async function aiReply(ws: Workspace, system: string, msgs: Msg[]) {
  if ((await getUsage(ws.id)).aiCalls >= ws.monthlyAiLimit) return null;
  const cred = await prisma.aiCredential.findFirst({ where: { workspaceId: ws.id, provider: ws.aiProvider } });
  if (!cred) return null;
  const key = decrypt(cred.keyEnc);
  while (msgs.length && msgs[0].role === "assistant") msgs = msgs.slice(1); // a conversa precisa começar pelo usuário
  await bump(ws.id, "aiCalls");
  if (ws.aiProvider === "openai") {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: ws.aiModel, messages: [{ role: "system", content: system }, ...msgs] }),
    });
    return r.ok ? ((await r.json()).choices?.[0]?.message?.content ?? null) : null;
  }
  const r = await new Anthropic({ apiKey: key }).messages.create({ model: ws.aiModel, max_tokens: 600, system, messages: msgs }).catch(() => null);
  return r?.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? null;
}

export const makeCtx = (ws: Workspace, history: Msg[], contactId?: string): Ctx => ({
  history,
  ai: (p, msgs) => aiReply(ws, `${ws.aiPrompt}\n\n${p}`, msgs),
  lead: async (v) => { if (contactId && v.nome && v.telefone) await salvarLead(ws, contactId, { nome: v.nome, telefone: v.telefone, interesse: v.interesse ?? "" }); },
});

// Conversa real: continua o chatbot do contato ou inicia o ativo do cliente. null = sem chatbot.
export async function handleIncoming(ws: Workspace, contact: Contact, text: string): Promise<string[] | null> {
  let bot = contact.chatbotId ? await prisma.chatbot.findFirst({ where: { id: contact.chatbotId, workspaceId: ws.id, active: true } }) : null;
  let state = (contact.flowState as unknown as State | null) ?? null;
  let input: string | null = text;
  if (!bot || !state || state.done) {
    const bots = await prisma.chatbot.findMany({ where: { workspaceId: ws.id, active: true }, orderBy: { createdAt: "asc" } });
    bot = bots.find((b) => b.trigger && text.toLowerCase().includes(b.trigger.toLowerCase())) ?? bots.find((b) => !b.trigger) ?? null;
    if (!bot) return null;
    state = { idx: 0, vars: {} }; input = null;
  }
  const past = await prisma.message.findMany({ where: { contactId: contact.id }, orderBy: { createdAt: "desc" }, take: 11 });
  const history: Msg[] = past.slice(1).reverse().map((m) => ({ role: m.direction === "IN" ? "user" : "assistant", content: m.text }));
  const out = await run(bot.nodes as unknown as Node[], state, input, makeCtx(ws, history, contact.id));
  await prisma.contact.update({ where: { id: contact.id }, data: { chatbotId: out.state.done ? null : bot.id, flowState: out.state.done ? Prisma.JsonNull : (out.state as any) } });
  return out.replies;
}
