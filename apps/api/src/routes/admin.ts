import argon2 from "argon2";
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db";
import { audit, guard } from "../services/access";
import { clearEvolutionCache } from "../services/evolution";
import { decrypt, encrypt } from "../services/crypto";

// Só o admin geral. Ele NÃO vê clientes nem chats: apenas conexões, gestores e métricas agregadas.
export async function adminRoutes(app: FastifyInstance) {
  const pre = { preHandler: guard(["PLATFORM_ADMIN"]) };

  app.post("/admin/managers", pre, async (req) => {
    const b = z.object({ email: z.string().email(), name: z.string(), password: z.string().min(12) }).parse(req.body);
    const u = await prisma.user.create({ data: { email: b.email.toLowerCase(), name: b.name, role: "MANAGER", passwordHash: await argon2.hash(b.password, { type: argon2.argon2id }) } });
    await audit(req, "gestor.criado", undefined, { managerId: u.id });
    return { id: u.id, email: u.email };
  });

  app.get("/admin/metrics", pre, async () => ({
    workspaces: await prisma.workspace.count(),
    gestores: await prisma.user.count({ where: { role: "MANAGER" } }),
    usoMesAtual: await prisma.usageCounter.aggregate({ where: { month: new Date().toISOString().slice(0, 7) }, _sum: { aiCalls: true, messages: true } }),
  }));

  // Conexões da plataforma (config sempre criptografada, nunca devolvida)
  app.get("/admin/integrations", pre, async () =>
    (await prisma.integration.findMany()).map((i) => ({ id: i.id, type: i.type, name: i.name, active: i.active })));

  app.post("/admin/integrations", pre, async (req) => {
    const b = z.object({ type: z.enum(["EVOLUTION", "REDIS", "OTHER"]), name: z.string(), config: z.record(z.string()) }).parse(req.body);
    const i = await prisma.integration.create({ data: { type: b.type, name: b.name, configEnc: encrypt(JSON.stringify(b.config)) } });
    clearEvolutionCache();
    await audit(req, "integracao.criada", undefined, { type: b.type });
    return { id: i.id };
  });

  app.delete("/admin/integrations/:id", pre, async (req) => {
    const { id } = req.params as { id: string };
    await prisma.integration.delete({ where: { id } });
    clearEvolutionCache();
    await audit(req, "integracao.removida", undefined, { id });
    return { ok: true };
  });

  app.post("/admin/integrations/:id/test", pre, async (req, reply) => {
    const { id } = req.params as { id: string };
    const i = await prisma.integration.findUniqueOrThrow({ where: { id } });
    if (i.type !== "EVOLUTION") return { ok: true, nota: "teste disponível só para Evolution por enquanto" };
    const c = JSON.parse(decrypt(i.configEnc));
    const r = await fetch(`${c.url}/instance/fetchInstances`, { headers: { apikey: c.apiKey } }).catch(() => null);
    return r?.ok ? { ok: true } : reply.code(502).send({ ok: false });
  });
}
