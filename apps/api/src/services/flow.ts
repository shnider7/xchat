import Anthropic from "@anthropic-ai/sdk";
import { Contact, Prisma, Workspace } from "@prisma/client";
import { prisma } from "../db";
import { salvarLead } from "./ai";
import { decrypt } from "./crypto";
import { bump, getUsage } from "./usage";

export type GNode = { id: string; type: string; position: { x: number; y: number }; data: any };
export type GEdge = { id?: string; source: string; sourceHandle?: string | null; target: string };
export type Graph = { v: 2; nodes: GNode[]; edges: GEdge[] };
export type State = { cur: string | null; vars: Record<string, string>; tags: string[]; wait?: "button" | "answer" | "ai"; aiTurns?: number; done?: boolean };
export type Msg = { role: "user" | "assistant"; content: string };
type Ctx = {
  history: Msg[]; ai: (prompt: string, msgs: Msg[]) => Promise<string | null>;
  lead: (v: Record<string, string>) => Promise<void>; tag: (t: string) => Promise<void>;
};

const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");
const menu = (d: any, v: Record<string, string>) =>
  [fill(d.text ?? "Escolha uma opção:", v), ...(d.buttons ?? []).map((b: any, i: number) => `${i + 1}. ${b.label}`)].join("\n");
const validate = (kind: string | undefined, v: string) => {
  if (kind === "phone" && !/^\d{10,13}$/.test(v.replace(/\D/g, ""))) return "Não consegui entender o telefone. Envie com DDD, por favor.";
  if (kind === "email" && !/^\S+@\S+\.\S+$/.test(v)) return "Esse email não parece válido. Pode enviar de novo?";
  if (kind === "number" && !/^\d+([.,]\d+)?$/.test(v)) return "Envie apenas números, por favor.";
  return null;
};
const cond = (d: any, vars: Record<string, string>) => {
  const v = (vars[d.variable] ?? "").toLowerCase(), x = fill(d.value ?? "", vars).toLowerCase();
  return d.op === "set" ? v !== "" : d.op === "contains" ? v.includes(x) : v === x;
};

// Chatbots antigos (lista de passos) viram grafo na leitura
export function toGraph(raw: any): Graph {
  if (raw && !Array.isArray(raw) && raw.v === 2) return raw as Graph;
  const arr: any[] = Array.isArray(raw) ? raw : [];
  const nodes: GNode[] = [{ id: "start", type: "start", position: { x: 0, y: 120 }, data: {} }];
  const edges: GEdge[] = [];
  arr.forEach((n, i) => {
    const data: any = { ...n };
    if (n.type === "options") data.buttons = (n.options ?? []).map((o: any, k: number) => ({ id: String(k), label: o.label }));
    if (n.type === "lead") data.lead = true;
    nodes.push({ id: n.id, type: n.type === "options" ? "message" : n.type === "lead" ? "action" : n.type, position: { x: 380 * (i + 1), y: 100 }, data });
    const nxt = arr[i + 1]?.id;
    if (n.type === "options") (n.options ?? []).forEach((o: any, k: number) => { const t = o.goto ?? nxt; if (t) edges.push({ source: n.id, sourceHandle: `b_${k}`, target: t }); });
    else if (nxt) edges.push({ source: n.id, sourceHandle: "out", target: nxt });
  });
  if (arr[0]) edges.push({ source: "start", sourceHandle: "out", target: arr[0].id });
  return { v: 2, nodes, edges };
}

// Motor do chatbot (estilo ManyChat): cada passo aponta para o próximo; botões e condições têm saídas próprias
export async function run(g: Graph, st: State, input: string | null, ctx: Ctx) {
  const s: State = { ...st, vars: { ...st.vars }, tags: [...(st.tags ?? [])] };
  const replies: string[] = [];
  const node = (id: string | null) => g.nodes.find((n) => n.id === id);
  const go = (id: string, h = "out") => { s.cur = g.edges.find((e) => e.source === id && (e.sourceHandle ?? "out") === h)?.target ?? null; };

  if (s.cur === null && !s.done) { const start = g.nodes.find((n) => n.type === "start"); if (start) go(start.id); }

  if (input !== null && s.wait && s.cur) {
    const n = node(s.cur)!; const d = n.data ?? {};
    if (s.wait === "button") {
      const t = input.trim().toLowerCase(); const btns: any[] = d.buttons ?? [];
      const i = btns.findIndex((b, k) => t === String(k + 1) || t === String(b.label).toLowerCase());
      if (i < 0) return { replies: ["Não entendi. " + menu(d, s.vars)], state: s };
      if (d.save) s.vars[d.save] = btns[i].label;
      s.wait = undefined; go(n.id, `b_${btns[i].id}`);
    } else if (s.wait === "answer") {
      const v = input.trim(); const err = validate(d.kind, v);
      if (err) return { replies: [err], state: s };
      if (d.save) s.vars[d.save] = v;
      s.wait = undefined; go(n.id);
    } else if (s.wait === "ai") {
      const out = await ctx.ai(fill(d.prompt ?? "", s.vars), [...ctx.history, { role: "user", content: input }]);
      replies.push(out ?? "No momento não consigo responder. Já já retornamos.");
      s.aiTurns = (s.aiTurns ?? 0) + 1;
      if (s.aiTurns < (d.turns ?? 1)) return { replies, state: s };
      s.wait = undefined; s.aiTurns = 0; go(n.id);
    }
  }

  for (let guard = 0; guard < 40 && s.cur && !s.wait; guard++) {
    const n = node(s.cur); if (!n) { s.cur = null; break; }
    const d = n.data ?? {};
    if (n.type === "message") {
      if ((d.buttons ?? []).length) { replies.push(menu(d, s.vars)); s.wait = "button"; }
      else { if (d.text) replies.push(fill(d.text, s.vars)); go(n.id); }
    } else if (n.type === "question") { replies.push(fill(d.text ?? "", s.vars)); s.wait = "answer"; }
    else if (n.type === "ai") { if (d.text) replies.push(fill(d.text, s.vars)); s.wait = "ai"; s.aiTurns = 0; }
    else if (n.type === "condition") go(n.id, cond(d, s.vars) ? "yes" : "no");
    else if (n.type === "action") {
      if (d.tag && !s.tags.includes(d.tag)) { s.tags.push(d.tag); await ctx.tag(d.tag); }
      if (d.varName) s.vars[d.varName] = fill(d.varValue ?? "", s.vars);
      if (d.lead) await ctx.lead(s.vars);
      go(n.id);
    } else go(n.id);
  }
  if (!s.cur && !s.wait) s.done = true;
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
  tag: async (t) => {
    if (!contactId) return;
    const c = await prisma.contact.findUnique({ where: { id: contactId }, select: { tags: true } });
    if (c && !c.tags.includes(t)) await prisma.contact.update({ where: { id: contactId }, data: { tags: { push: t } } });
  },
});

// Conversa real: continua o chatbot do contato ou inicia o ativo do cliente. null = sem chatbot.
export async function handleIncoming(ws: Workspace, contact: Contact, text: string): Promise<string[] | null> {
  let bot = contact.chatbotId ? await prisma.chatbot.findFirst({ where: { id: contact.chatbotId, workspaceId: ws.id, active: true } }) : null;
  let state = contact.flowState as unknown as State | null;
  let input: string | null = text;
  if (!bot || !state || state.done || !("cur" in state)) {
    const bots = await prisma.chatbot.findMany({ where: { workspaceId: ws.id, active: true }, orderBy: { createdAt: "asc" } });
    bot = bots.find((b) => b.trigger && text.toLowerCase().includes(b.trigger.toLowerCase())) ?? bots.find((b) => !b.trigger) ?? null;
    if (!bot) return null;
    state = { cur: null, vars: {}, tags: [] }; input = null;
  }
  const past = await prisma.message.findMany({ where: { contactId: contact.id }, orderBy: { createdAt: "desc" }, take: 11 });
  const history: Msg[] = past.slice(1).reverse().map((m) => ({ role: m.direction === "IN" ? "user" : "assistant", content: m.text }));
  const out = await run(toGraph(bot.nodes), state, input, makeCtx(ws, history, contact.id));
  await prisma.contact.update({ where: { id: contact.id }, data: { chatbotId: out.state.done ? null : bot.id, flowState: out.state.done ? Prisma.JsonNull : (out.state as any) } });
  return out.replies;
}
