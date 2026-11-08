import Anthropic from "@anthropic-ai/sdk";
import { lookup } from "dns/promises";
import { isIP } from "net";
import { Contact, Prisma, Workspace } from "@prisma/client";
import { prisma } from "../db";
import { salvarLead } from "./ai";
import { decrypt } from "./crypto";
import { sendText } from "./evolution";
import { bump, getUsage, recordUsage } from "./usage";

export type GNode = { id: string; type: string; position: { x: number; y: number }; data: any };
export type GEdge = { id?: string; source: string; sourceHandle?: string | null; target: string };
export type Graph = { v: 2; nodes: GNode[]; edges: GEdge[] };
export type State = { cur: string | null; vars: Record<string, string>; tags: string[]; wait?: "button" | "answer" | "ai"; aiTurns?: number; done?: boolean };
export type Msg = { role: "user" | "assistant"; content: string };
export type Ev = { kind: "dm" | "comment" | "story_reply" | "story_mention" | "ad" | "ref"; text: string; postId?: string };
type Info = { channel: string; source: string; tags: string[] };
type Ctx = {
  history: Msg[]; info: Info;
  ai: (system: string, msgs: Msg[]) => Promise<string | null>;
  lead: (v: Record<string, string>) => Promise<void>;
  tag: (t: string, on: boolean) => Promise<void>;
  notify: (text: string) => Promise<void>;
  pause: () => Promise<void>;
  http: (url: string, method: string, body: any) => Promise<void>;
};

const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");
const isReply = (b: any) => (b.type ?? "reply") === "reply";
const menu = (d: any, v: Record<string, string>) => {
  const btns: any[] = d.buttons ?? [];
  return [fill(d.text ?? "Escolha uma opção:", v),
    ...btns.filter(isReply).map((b, i) => `${i + 1}. ${b.label}`),
    ...btns.filter((b) => b.type === "url").map((b) => `🔗 ${b.label}: ${b.url}`)].join("\n");
};
const validate = (kind: string | undefined, v: string) => {
  if (kind === "phone" && !/^\d{10,13}$/.test(v.replace(/\D/g, ""))) return "Não consegui entender o telefone. Envie com DDD, por favor.";
  if (kind === "email" && !/^\S+@\S+\.\S+$/.test(v)) return "Esse email não parece válido. Pode enviar de novo?";
  if (kind === "number" && !/^\d+([.,]\d+)?$/.test(v)) return "Envie apenas números, por favor.";
  return null;
};
const nowHM = () => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Campo_Grande", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());

function rule(r: any, s: State, ctx: Ctx): boolean {
  const val = String(r.value ?? "");
  if (r.field === "tag") { const has = [...s.tags, ...ctx.info.tags].includes(r.name || val); return r.op === "not_has" ? !has : has; }
  if (r.field === "channel") return (r.op === "neq") !== (ctx.info.channel === val);
  if (r.field === "source") { const v = ctx.info.source.toLowerCase(), x = val.toLowerCase(); return r.op === "contains" ? v.includes(x) : v === x; }
  if (r.field === "time") { const [a, b] = val.split("-"); const n = nowHM(); return a && b ? (a <= b ? n >= a && n <= b : n >= a || n <= b) : true; }
  const v = s.vars[r.name] ?? "", l = v.toLowerCase(), x = fill(val, s.vars).toLowerCase(), num = (t: string) => parseFloat(t.replace(",", "."));
  switch (r.op) {
    case "neq": return l !== x; case "contains": return l.includes(x); case "starts": return l.startsWith(x); case "ends": return l.endsWith(x);
    case "set": return v !== ""; case "empty": return v === ""; case "gt": return num(v) > num(x); case "lt": return num(v) < num(x);
    default: return l === x;
  }
}
const rulesOf = (d: any) => d.rules ?? (d.variable ? [{ field: "var", name: d.variable, op: d.op ?? "eq", value: d.value }] : []);
const actionsOf = (d: any) => d.actions ?? [d.tag && { type: "tag_add", tag: d.tag }, d.varName && { type: "var_set", name: d.varName, value: d.varValue }, d.lead && { type: "lead" }].filter(Boolean);

async function act(a: any, s: State, ctx: Ctx) {
  switch (a.type) {
    case "tag_add": if (a.tag && !s.tags.includes(a.tag)) { s.tags.push(a.tag); await ctx.tag(a.tag, true); } break;
    case "tag_remove": s.tags = s.tags.filter((t) => t !== a.tag); if (a.tag) await ctx.tag(a.tag, false); break;
    case "var_set": if (a.name) s.vars[a.name] = fill(a.value ?? "", s.vars); break;
    case "var_clear": delete s.vars[a.name]; break;
    case "notify": await ctx.notify(fill(a.text ?? "", s.vars)); break;
    case "lead": await ctx.lead(s.vars); break;
    case "pause": await ctx.pause(); break;
    case "http": await ctx.http(fill(a.url ?? "", s.vars), a.method ?? "POST", s.vars); break;
  }
}

// ---- gatilhos ----
const kws = (t: string) => (t ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
export function triggersOf(g: Graph): any[] {
  const d = g.nodes.find((n) => n.type === "start")?.data ?? {};
  return d.triggers ?? (d.trigger ? [{ type: "dm", match: "contains", keywords: d.trigger }] : []);
}
// -1 = não combina; 0 = gatilho genérico; 1 = palavra específica (tem prioridade)
export function score(g: Graph, ev: Ev): number {
  const ts = triggersOf(g);
  if (!ts.length) return ev.kind === "dm" ? 0 : -1;
  let best = -1;
  for (const t of ts) {
    if (t.type !== ev.kind) continue;
    if (t.scope === "post" && t.postId && ev.postId && !String(ev.postId).includes(String(t.postId).trim())) continue;
    const k = kws(t.keywords), txt = ev.text.toLowerCase().trim(), generic = t.match === "any" || !k.length;
    if (generic || (t.match === "exact" ? k.includes(txt) : k.some((x) => txt.includes(x)))) best = Math.max(best, generic ? 0 : 1);
  }
  return best;
}

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
  const start = g.nodes.find((n) => n.type === "start");
  const node = (id: string | null) => g.nodes.find((n) => n.id === id);
  const go = (id: string, h = "out") => { s.cur = g.edges.find((e) => e.source === id && (e.sourceHandle ?? "out") === h)?.target ?? null; };
  const sys = (n: any) => [start?.data?.aiPrompt, fill(n.prompt ?? "", s.vars)].filter(Boolean).join("\n\n");

  if (s.cur === null && !s.done && start) go(start.id);

  if (input !== null && s.wait && s.cur) {
    const n = node(s.cur)!; const d = n.data ?? {};
    if (s.wait === "button") {
      const t = input.trim().toLowerCase(); const btns: any[] = (d.buttons ?? []).filter(isReply);
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
      if (d.exit && input.trim().toLowerCase() === String(d.exit).trim().toLowerCase()) { s.wait = undefined; s.aiTurns = 0; go(n.id); }
      else {
        const out = await ctx.ai(sys(d), [...ctx.history, { role: "user", content: input }]);
        replies.push(out ?? "No momento não consigo responder. Já já retornamos.");
        s.aiTurns = (s.aiTurns ?? 0) + 1;
        if (d.turns === 0 || s.aiTurns < (d.turns ?? 1)) return { replies, state: s }; // 0 = a IA responde sempre
        s.wait = undefined; s.aiTurns = 0; go(n.id);
      }
    }
  }

  for (let guard = 0; guard < 40 && s.cur && !s.wait; guard++) {
    const n = node(s.cur); if (!n) { s.cur = null; break; }
    const d = n.data ?? {};
    if (n.type === "message") {
      if ((d.buttons ?? []).some(isReply)) { replies.push(menu(d, s.vars)); s.wait = "button"; }
      else { if (d.text || (d.buttons ?? []).length) replies.push(menu({ ...d, text: d.text ?? "" }, s.vars)); go(n.id); }
    } else if (n.type === "question") { replies.push(fill(d.text ?? "", s.vars)); s.wait = "answer"; }
    else if (n.type === "ai") { if (d.text) replies.push(fill(d.text, s.vars)); s.wait = "ai"; s.aiTurns = 0; }
    else if (n.type === "condition") {
      const rs = rulesOf(d), ok = !rs.length ? false : d.match === "any" ? rs.some((r: any) => rule(r, s, ctx)) : rs.every((r: any) => rule(r, s, ctx));
      go(n.id, ok ? "yes" : "no");
    } else if (n.type === "action") { for (const a of actionsOf(d)) await act(a, s, ctx); go(n.id); }
    else go(n.id);
  }
  if (!s.cur && !s.wait) s.done = true;
  return { replies, state: s };
}

// ---- IA com a chave do próprio cliente (BYOK), respeitando o limite mensal ----
export async function aiReply(ws: Workspace, system: string, msgs: Msg[]) {
  if ((await getUsage(ws.id)).aiCalls >= ws.monthlyAiLimit) return null;
  const cred = await prisma.aiCredential.findFirst({ where: { workspaceId: ws.id, provider: ws.aiProvider } });
  if (!cred) return null;
  const key = decrypt(cred.keyEnc);
  while (msgs.length && msgs[0].role === "assistant") msgs = msgs.slice(1);
  await bump(ws.id, "aiCalls");
  if (ws.aiProvider === "openai") {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: ws.aiModel, messages: [{ role: "system", content: system }, ...msgs] }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    await recordUsage(ws, j.usage?.prompt_tokens ?? 0, j.usage?.completion_tokens ?? 0);
    return j.choices?.[0]?.message?.content ?? null;
  }
  const r = await new Anthropic({ apiKey: key }).messages.create({ model: ws.aiModel, max_tokens: 600, system, messages: msgs }).catch(() => null);
  if (r) await recordUsage(ws, r.usage?.input_tokens ?? 0, r.usage?.output_tokens ?? 0);
  return r?.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? null;
}

// Requisição externa: só HTTPS e nunca para endereços internos (evita acesso à rede da VPS)
const priv = (ip: string) => /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|fc|fd|fe80)/i.test(ip);
async function safeHttp(url: string, method: string, body: any) {
  try {
    const u = new URL(url); if (u.protocol !== "https:") return;
    const ips = isIP(u.hostname) ? [{ address: u.hostname }] : await lookup(u.hostname, { all: true });
    if (ips.some((i) => priv(i.address))) return;
    await fetch(u, { method: method === "GET" ? "GET" : "POST", headers: { "Content-Type": "application/json" }, body: method === "GET" ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5000), redirect: "manual" });
  } catch { /* uma falha externa nunca derruba a conversa */ }
}

export const makeCtx = (ws: Workspace, history: Msg[], contactId?: string, info: Info = { channel: "SIMULADOR", source: "", tags: [] }): Ctx => ({
  history, info,
  ai: (p, msgs) => aiReply(ws, [ws.aiPrompt, p].filter(Boolean).join("\n\n"), msgs),
  lead: async (v) => { if (contactId && v.nome && v.telefone) await salvarLead(ws, contactId, { nome: v.nome, telefone: v.telefone, interesse: v.interesse ?? "" }); },
  tag: async (t, on) => {
    if (!contactId) return;
    const c = await prisma.contact.findUnique({ where: { id: contactId }, select: { tags: true } });
    if (!c) return;
    const tags = on ? (c.tags.includes(t) ? c.tags : [...c.tags, t]) : c.tags.filter((x) => x !== t);
    await prisma.contact.update({ where: { id: contactId }, data: { tags } });
  },
  notify: async (text) => { if (ws.evolutionInstance && ws.leadDestination) await sendText(ws.evolutionInstance, ws.leadDestination, text).catch(() => {}); },
  pause: async () => { if (contactId) await prisma.contact.update({ where: { id: contactId }, data: { botPaused: true } }); },
  http: safeHttp,
});

// Resposta pública a um comentário: texto fixo (uma variação sorteada) ou IA com instrução própria para comentários
export async function commentReply(ws: Workspace, g: Graph, text: string): Promise<string | null> {
  const c = g.nodes.find((n) => n.type === "start")?.data?.commentReply;
  if (!c || c.mode === "none" || !c.mode) return null;
  if (c.mode === "ai") return aiReply(ws, [ws.aiPrompt, c.prompt].filter(Boolean).join("\n\n"), [{ role: "user", content: text }]);
  const v = String(c.variations ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
  return v.length ? v[Math.floor(Math.random() * v.length)] : null;
}

// Conversa real: continua o chatbot do contato ou inicia o que combina com o gatilho. null = nenhum chatbot.
export async function handleEvent(ws: Workspace, contact: Contact, text: string, ev: Ev = { kind: "dm", text }): Promise<{ replies: string[]; graph: Graph } | null> {
  let bot = contact.chatbotId ? await prisma.chatbot.findFirst({ where: { id: contact.chatbotId, workspaceId: ws.id, active: true } }) : null;
  let state = contact.flowState as unknown as State | null;
  let input: string | null = text;
  if (!bot || !state || state.done || !("cur" in state) || ev.kind !== "dm") {
    const bots = await prisma.chatbot.findMany({ where: { workspaceId: ws.id, active: true }, orderBy: { createdAt: "asc" } });
    const ranked = bots.map((b) => ({ b, sc: score(toGraph(b.nodes), ev) })).filter((x) => x.sc >= 0).sort((a, b) => b.sc - a.sc);
    if (!ranked.length) return null;
    bot = ranked[0].b; state = { cur: null, vars: {}, tags: [] }; input = null;
  }
  const past = await prisma.message.findMany({ where: { contactId: contact.id }, orderBy: { createdAt: "desc" }, take: 11 });
  const history: Msg[] = past.slice(1).reverse().map((m) => ({ role: m.direction === "IN" ? "user" : "assistant", content: m.text }));
  const info = { channel: contact.channel, source: contact.source ?? "", tags: contact.tags };
  const out = await run(toGraph(bot.nodes), state, input, makeCtx(ws, history, contact.id, info));
  await prisma.contact.update({ where: { id: contact.id }, data: { chatbotId: out.state.done ? null : bot.id, flowState: out.state.done ? Prisma.JsonNull : (out.state as any) } });
  return { replies: out.replies, graph: toGraph(bot.nodes) };
}
export const handleIncoming = async (...a: Parameters<typeof handleEvent>) => (await handleEvent(...a))?.replies ?? null;
