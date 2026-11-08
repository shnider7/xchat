import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db";
import { assertWorkspace, guard } from "../services/access";
import { decrypt } from "../services/crypto";

const DEFAULTS = {
  anthropic: ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5", "claude-sonnet-4-6"],
  openai: ["gpt-5", "gpt-5-mini", "gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini"],
};
const cache = new Map<string, { at: number; models: string[] }>();

export async function aiModelRoutes(app: FastifyInstance) {
  // Lista de modelos: consulta o provedor com a chave do próprio cliente (assim aparecem todas as versões atuais)
  app.get("/workspaces/:id/ai-models", { preHandler: guard(["MANAGER", "CLIENT"]) }, async (req) => {
    const { id } = req.params as { id: string };
    await assertWorkspace(req, id);
    const { provider } = z.object({ provider: z.enum(["anthropic", "openai"]) }).parse(req.query);
    const cred = await prisma.aiCredential.findFirst({ where: { workspaceId: id, provider } });
    if (!cred) return { models: DEFAULTS[provider], fonte: "padrao" };
    const key = `${id}:${provider}:${cred.id}`, hit = cache.get(key);
    if (hit && Date.now() - hit.at < 600_000) return { models: hit.models, fonte: "provedor" };
    try {
      const apiKey = decrypt(cred.keyEnc);
      let models: string[];
      if (provider === "anthropic") {
        const r = await fetch("https://api.anthropic.com/v1/models?limit=1000", { headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }, signal: AbortSignal.timeout(8000) });
        if (!r.ok) throw new Error(String(r.status));
        models = ((await r.json()) as any).data.map((m: any) => m.id);
      } else {
        const r = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(8000) });
        if (!r.ok) throw new Error(String(r.status));
        models = ((await r.json()) as any).data.map((m: any) => m.id as string)
          .filter((m: string) => /^(gpt-|o\d|chatgpt-)/.test(m) && !/(embedding|audio|realtime|transcribe|tts|image|moderation|search|instruct)/.test(m)).sort();
      }
      cache.set(key, { at: Date.now(), models });
      return { models, fonte: "provedor" };
    } catch {
      return { models: DEFAULTS[provider], fonte: "padrao", aviso: "Não consegui consultar o provedor com a sua chave. Mostrando a lista padrão." };
    }
  });
}
