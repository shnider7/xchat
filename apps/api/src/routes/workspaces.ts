import argon2 from "argon2";
import { randomBytes } from "crypto";
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db";
import { assertWorkspace, audit, guard } from "../services/access";
import { encrypt } from "../services/crypto";

export async function workspaceRoutes(app: FastifyInstance) {
  const pre = { preHandler: guard(["MANAGER", "CLIENT"]) };

  // Seletor de clientes: só os vinculados ao usuário
  app.get("/workspaces", pre, async (req) => {
    const list = await prisma.workspace.findMany({ where: { members: { some: { userId: req.user.id } } }, orderBy: { name: "asc" } });
    return list.map((w) => ({ ...w, own: w.ownerId === req.user.id }));
  });

  // Gestor cria o cliente (workspace) e, opcionalmente, a conta de acesso do cliente
  app.post("/workspaces", { preHandler: guard(["MANAGER"]) }, async (req) => {
    const b = z.object({
      name: z.string().min(1), clientEmail: z.string().email().optional(), instagram: z.string().optional(),
      evolutionInstance: z.string().optional(), leadDestination: z.string().optional(),
    }).parse(req.body);
    const ws = await prisma.workspace.create({
      data: { name: b.name, clientEmail: b.clientEmail, instagram: b.instagram, evolutionInstance: b.evolutionInstance,
        leadDestination: b.leadDestination, members: { create: { userId: req.user.id } } },
    });
    let senhaTemporaria: string | undefined;
    if (b.clientEmail) {
      senhaTemporaria = randomBytes(9).toString("base64url"); // TODO: trocar por convite por email
      const client = await prisma.user.upsert({
        where: { email: b.clientEmail.toLowerCase() }, update: {},
        create: { email: b.clientEmail.toLowerCase(), name: b.name, role: "CLIENT", passwordHash: await argon2.hash(senhaTemporaria, { type: argon2.argon2id }) },
      });
      await prisma.membership.create({ data: { userId: client.id, workspaceId: ws.id } });
    }
    await audit(req, "workspace.criado", ws.id);
    return { workspace: ws, senhaTemporaria };
  });

  app.patch("/workspaces/:id", pre, async (req) => {
    const { id } = req.params as { id: string };
    await assertWorkspace(req, id);
    const data = z.object({
      name: z.string().optional(), instagram: z.string().optional(), evolutionInstance: z.string().optional(),
      aiEnabled: z.boolean().optional(), aiProvider: z.enum(["anthropic", "openai"]).optional(), aiModel: z.string().optional(),
      aiPrompt: z.string().optional(), leadDestination: z.string().optional(), leadTemplate: z.string().optional(),
      aiBudgetBrl: z.number().int().min(0).max(1000000).optional(),
    }).parse(req.body);
    await audit(req, "workspace.editado", id, { campos: Object.keys(data) });
    return prisma.workspace.update({ where: { id }, data });
  });

  // Consumo de IA do mês (estimativa em R$ pelo uso de tokens)
  app.get("/workspaces/:id/ai-usage", pre, async (req) => {
    const { id } = req.params as { id: string };
    await assertWorkspace(req, id);
    const ws = await prisma.workspace.findUniqueOrThrow({ where: { id } });
    const now = new Date(), from = new Date(now.getFullYear(), now.getMonth(), 1);
    const a = await prisma.usageEvent.aggregate({ where: { workspaceId: id, createdAt: { gte: from } }, _sum: { inputTokens: true, outputTokens: true, costBrl: true }, _count: true });
    return { respostas: a._count, tokensEntrada: a._sum.inputTokens ?? 0, tokensSaida: a._sum.outputTokens ?? 0, custoBrl: a._sum.costBrl ?? 0, limiteRespostas: ws.monthlyAiLimit, orcamentoBrl: ws.aiBudgetBrl };
  });

  // Chats: sempre de UM workspace por vez, com filtros e auditoria
  app.get("/workspaces/:id/contacts", pre, async (req) => {
    const { id } = req.params as { id: string };
    await assertWorkspace(req, id);
    const f = z.object({
      q: z.string().optional(), lead: z.string().optional(), tag: z.string().optional(),
      channel: z.enum(["WHATSAPP", "INSTAGRAM_DM", "INSTAGRAM_COMMENT"]).optional(),
    }).parse(req.query);
    await audit(req, "chats.listados", id, { filtros: Object.keys(f) });
    return prisma.contact.findMany({
      where: {
        workspaceId: id,
        ...(f.channel && { channel: f.channel }),
        ...(f.lead === "1" && { leadSentAt: { not: null } }),
        ...(f.tag && { tags: { has: f.tag } }),
        ...(f.q && { OR: [
          { name: { contains: f.q, mode: "insensitive" } }, { phone: { contains: f.q } },
          { messages: { some: { text: { contains: f.q, mode: "insensitive" } } } },
        ] }),
      },
      orderBy: { createdAt: "desc" }, take: 200,
      include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
  });

  // Relatório de conversas do período
  app.get("/workspaces/:id/report", pre, async (req) => {
    const { id } = req.params as { id: string };
    await assertWorkspace(req, id);
    const days = Math.min(Number((req.query as any).days ?? 30) || 30, 90);
    const since = new Date(Date.now() - days * 864e5);
    const [contatos, leads, porTipo, porDia] = await Promise.all([
      prisma.contact.count({ where: { workspaceId: id, createdAt: { gte: since } } }),
      prisma.contact.count({ where: { workspaceId: id, leadSentAt: { gte: since } } }),
      prisma.message.groupBy({ by: ["sender"], where: { contact: { workspaceId: id }, createdAt: { gte: since } }, _count: true }),
      prisma.$queryRaw<{ dia: Date; total: bigint }[]>`SELECT date_trunc('day', m."createdAt") AS dia, count(*) AS total FROM "Message" m JOIN "Contact" c ON c.id = m."contactId" WHERE c."workspaceId" = ${id} AND m."createdAt" >= ${since} GROUP BY 1 ORDER BY 1`,
    ]);
    return {
      dias: days, contatos, leads,
      mensagens: Object.fromEntries(porTipo.map((b) => [b.sender, b._count])),
      porDia: porDia.map((r) => ({ dia: r.dia.toISOString().slice(0, 10), total: Number(r.total) })),
    };
  });

  // Assumir ou devolver a conversa ao bot/IA (botPaused = humano no controle)
  app.patch("/contacts/:id", pre, async (req) => {
    const { id } = req.params as { id: string };
    const c = await prisma.contact.findUniqueOrThrow({ where: { id } });
    await assertWorkspace(req, c.workspaceId);
    const b = z.object({ botPaused: z.boolean().optional(), tags: z.array(z.string().max(40)).max(30).optional() }).parse(req.body);
    await audit(req, b.botPaused === undefined ? "contato.editado" : b.botPaused ? "bot.pausado" : "bot.retomado", c.workspaceId, { contactId: id });
    return prisma.contact.update({ where: { id }, data: b });
  });

  app.get("/contacts/:id/messages", pre, async (req) => {
    const { id } = req.params as { id: string };
    const c = await prisma.contact.findUniqueOrThrow({ where: { id } });
    await assertWorkspace(req, c.workspaceId);
    await audit(req, "chat.aberto", c.workspaceId, { contactId: id });
    return prisma.message.findMany({ where: { contactId: id }, orderBy: { createdAt: "asc" } });
  });

  // Chaves de IA do próprio workspace (a chave nunca volta ao front)
  app.get("/workspaces/:id/ai-credentials", pre, async (req) => {
    const { id } = req.params as { id: string };
    await assertWorkspace(req, id);
    const rows = await prisma.aiCredential.findMany({ where: { workspaceId: id } });
    return rows.map((r) => ({ id: r.id, provider: r.provider, label: r.label, mascara: `••••${r.last4}` }));
  });

  app.post("/workspaces/:id/ai-credentials", pre, async (req) => {
    const { id } = req.params as { id: string };
    await assertWorkspace(req, id);
    const b = z.object({ provider: z.enum(["anthropic", "openai"]), label: z.string().min(1), apiKey: z.string().min(10) }).parse(req.body);
    const r = await prisma.aiCredential.create({ data: { workspaceId: id, provider: b.provider, label: b.label, keyEnc: encrypt(b.apiKey), last4: b.apiKey.slice(-4) } });
    await audit(req, "credencial.adicionada", id, { provider: b.provider });
    return { id: r.id, mascara: `••••${r.last4}` };
  });

  app.delete("/ai-credentials/:id", pre, async (req) => {
    const { id } = req.params as { id: string };
    const c = await prisma.aiCredential.findUniqueOrThrow({ where: { id } });
    await assertWorkspace(req, c.workspaceId);
    await prisma.aiCredential.delete({ where: { id } });
    await audit(req, "credencial.removida", c.workspaceId);
    return { ok: true };
  });
}
