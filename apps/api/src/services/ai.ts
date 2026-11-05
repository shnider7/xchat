import Anthropic from "@anthropic-ai/sdk";
import { Workspace } from "@prisma/client";
import { prisma } from "../db";
import { decrypt } from "./crypto";
import { sendText } from "./evolution";
import { buildLeadCard } from "./leadCard";
import { bump } from "./usage";

const schema = {
  type: "object",
  properties: { nome: { type: "string" }, telefone: { type: "string", description: "Com DDD" }, interesse: { type: "string" } },
  required: ["nome", "telefone", "interesse"],
};
const TOOL_DESC = "Salva o lead quando já souber nome, telefone e interesse. Não chame antes de ter os três.";

async function salvarLead(ws: Workspace, contactId: string, input: any) {
  const contact = await prisma.contact.update({
    where: { id: contactId },
    data: { name: input.nome, phone: input.telefone, interest: input.interesse, tags: { push: "lead-captado" }, leadSentAt: new Date() },
  });
  if (ws.leadDestination && ws.evolutionInstance) {
    await sendText(ws.evolutionInstance, ws.leadDestination, buildLeadCard({ ...input, contactId: contact.id }, ws.leadTemplate));
  }
  return "Lead salvo com sucesso.";
}

type Msg = { role: "user" | "assistant"; content: string };

async function viaAnthropic(apiKey: string, ws: Workspace, msgs: Msg[], onTool: (i: any) => Promise<string>) {
  const client = new Anthropic({ apiKey });
  const tools: Anthropic.Tool[] = [{ name: "salvar_lead", description: TOOL_DESC, input_schema: schema as any }];
  const base = { model: ws.aiModel, max_tokens: 1000, system: ws.aiPrompt, tools };
  let res = await client.messages.create({ ...base, messages: msgs });
  const tu = res.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
  if (res.stop_reason === "tool_use" && tu) {
    const out = await onTool(tu.input);
    res = await client.messages.create({
      ...base,
      messages: [...msgs, { role: "assistant", content: res.content }, { role: "user", content: [{ type: "tool_result", tool_use_id: tu.id, content: out }] }],
    });
  }
  return res.content.find((c): c is Anthropic.TextBlock => c.type === "text")?.text ?? null;
}

async function viaOpenAI(apiKey: string, ws: Workspace, msgs: Msg[], onTool: (i: any) => Promise<string>) {
  const call = async (messages: any[]) => {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: ws.aiModel, messages: [{ role: "system", content: ws.aiPrompt }, ...messages],
        tools: [{ type: "function", function: { name: "salvar_lead", description: TOOL_DESC, parameters: schema } }],
      }),
    });
    if (!r.ok) throw new Error(`OpenAI falhou: ${r.status}`);
    return (await r.json()).choices[0].message;
  };
  let m = await call(msgs);
  if (m.tool_calls?.length) {
    const t = m.tool_calls[0];
    const out = await onTool(JSON.parse(t.function.arguments));
    m = await call([...msgs, m, { role: "tool", tool_call_id: t.id, content: out }]);
  }
  return m.content ?? null;
}

// Usa SEMPRE a chave do próprio workspace (BYOK). Sem chave = sem resposta de IA.
export async function runAgent(ws: Workspace, contactId: string): Promise<string | null> {
  const cred = await prisma.aiCredential.findFirst({ where: { workspaceId: ws.id, provider: ws.aiProvider } });
  if (!cred) return null;
  const apiKey = decrypt(cred.keyEnc);
  const history = await prisma.message.findMany({ where: { contactId }, orderBy: { createdAt: "desc" }, take: 20 });
  const msgs: Msg[] = history.reverse().map((m) => ({ role: m.direction === "IN" ? "user" : "assistant", content: m.text }));
  await bump(ws.id, "aiCalls");
  const onTool = (i: any) => salvarLead(ws, contactId, i);
  return ws.aiProvider === "openai" ? viaOpenAI(apiKey, ws, msgs, onTool) : viaAnthropic(apiKey, ws, msgs, onTool);
}
