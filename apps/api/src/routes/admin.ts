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

  app.get("/admin/managers", pre, () =>
    prisma.user.findMany({ where: { role: "MANAGER" }, select: { id: true, email: true, name: true, totpEnabled: true, createdAt: true }, orderBy: { createdAt: "desc" } }));

  // Visão geral com séries por dia (30 dias). Só números agregados: o admin nunca vê clientes nem conversas.
  const rows = (r: { dia: Date; total: bigint }[]) => r.map((x) => ({ dia: x.dia.toISOString().slice(0, 10), total: Number(x.total) }));
  app.get("/admin/overview", pre, async () => {
    const since = new Date(Date.now() - 30 * 864e5), since7 = new Date(Date.now() - 7 * 864e5);
    const month = new Date().toISOString().slice(0, 7);
    const [roles, subs, novos, ativos, msgs, act7, usage, workspaces] = await Promise.all([
      prisma.user.groupBy({ by: ["role"], _count: true }),
      prisma.user.groupBy({ by: ["subscriptionStatus"], where: { role: "CLIENT" }, _count: true }),
      prisma.$queryRaw<{ dia: Date; total: bigint }[]>`SELECT date_trunc('day', "createdAt") AS dia, count(*) AS total FROM "User" WHERE "createdAt" >= ${since} GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<{ dia: Date; total: bigint }[]>`SELECT date_trunc('day', "createdAt") AS dia, count(DISTINCT "userId") AS total FROM "AuditLog" WHERE action = 'login.ok' AND "createdAt" >= ${since} GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<{ dia: Date; total: bigint }[]>`SELECT date_trunc('day', "createdAt") AS dia, count(*) AS total FROM "Message" WHERE "createdAt" >= ${since} GROUP BY 1 ORDER BY 1`,
      prisma.auditLog.findMany({ where: { action: "login.ok", createdAt: { gte: since7 }, userId: { not: null } }, distinct: ["userId"], select: { userId: true } }),
      prisma.usageCounter.aggregate({ where: { month }, _sum: { aiCalls: true, messages: true } }),
      prisma.workspace.count(),
    ]);
    const n = (role: string) => roles.find((r) => r.role === role)?._count ?? 0;
    const sub = (st: string) => subs.find((x) => x.subscriptionStatus === st)?._count ?? 0;
    const precoPlano = Number(process.env.PLAN_PRICE_BRL ?? 49);
    return {
      kpis: { contas: n("CLIENT"), gestores: n("MANAGER"), workspaces, ativos7d: act7.length, mrr: sub("ATIVA") * precoPlano, precoPlano },
      ativos: rows(ativos), novos: rows(novos), mensagens: rows(msgs),
      porTipo: [{ name: "Contas", value: n("CLIENT") }, { name: "Gestores", value: n("MANAGER") }, { name: "Admins", value: n("PLATFORM_ADMIN") }],
      assinaturas: [{ name: "Ativas", value: sub("ATIVA") }, { name: "Canceladas", value: sub("CANCELADA") }],
      ia: { chamadas: usage._sum.aiCalls ?? 0, mensagens: usage._sum.messages ?? 0 },
    };
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
