import { FastifyInstance } from "fastify";
import argon2 from "argon2";
import { z } from "zod";
import { prisma } from "../db";
import { audit, guard } from "../services/access";
import { passwordRule } from "../services/password";

// Mensagem única para qualquer falha, para não revelar se um email existe na plataforma
const GENERIC = "Não foi possível adicionar. Confirme se o email já tem conta na plataforma e se o Instagram dela está conectado.";
const NEED_IG = process.env.LINK_REQUIRES_INSTAGRAM !== "false"; // "false" só para testes sem Instagram

// O espaço de trabalho "da própria pessoa" (dono). Contas antigas sem dono usam o primeiro em que são membros.
const ownWorkspace = (userId: string) => prisma.workspace.findFirst({
  where: { OR: [{ ownerId: userId }, { ownerId: null, members: { some: { userId } } }] }, orderBy: { createdAt: "asc" }, include: { channels: true },
});
const ownedBy = (userId: string) => ({ OR: [{ ownerId: userId }, { ownerId: null, members: { some: { userId } } }] });

export async function profileRoutes(app: FastifyInstance) {
  const mgr = { preHandler: guard(["MANAGER", "CLIENT"]) };
  const cli = { preHandler: guard(["MANAGER", "CLIENT"]) };

  const ME = { id: true, email: true, name: true, username: true, avatar: true, role: true, totpEnabled: true, plan: true, planPeriod: true, subscriptionStatus: true, active: true, activeUntil: true } as const;
  const auth = { preHandler: guard(undefined, true, true) };

  app.get("/me", auth, (req) => prisma.user.findUniqueOrThrow({ where: { id: req.user.id }, select: ME }));

  app.patch("/me", auth, async (req, reply) => {
    const b = z.object({
      name: z.string().min(2).max(80).optional(),
      username: z.string().regex(/^[a-z0-9_.]{3,30}$/i, "Use 3 a 30 letras, números, . ou _").nullable().optional(),
      avatar: z.string().regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/).max(200_000).nullable().optional(),
    }).parse(req.body);
    try {
      const u = await prisma.user.update({
        where: { id: req.user.id },
        data: { ...(b.name && { name: b.name }), ...(b.username !== undefined && { username: b.username ? b.username.toLowerCase() : null }), ...(b.avatar !== undefined && { avatar: b.avatar }) },
        select: ME,
      });
      await audit(req, "perfil.editado", undefined, { campos: Object.keys(b) });
      return u;
    } catch (e: any) {
      if (e.code === "P2002") return reply.code(409).send({ error: "Esse nome de usuário já está em uso." });
      throw e;
    }
  });

  app.post("/me/password", { ...auth, config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } }, async (req, reply) => {
    const b = z.object({ current: z.string(), next: passwordRule }).parse(req.body);
    const u = await prisma.user.findUniqueOrThrow({ where: { id: req.user.id } });
    if (!(await argon2.verify(u.passwordHash, b.current))) return reply.code(400).send({ error: "Senha atual incorreta." });
    await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await argon2.hash(b.next, { type: argon2.argon2id }) } });
    await audit(req, "senha.alterada");
    return { ok: true };
  });

  // Ainda sem cobrança: só marca a assinatura como cancelada
  app.delete("/me/subscription", auth, async (req) => {
    await prisma.user.update({ where: { id: req.user.id }, data: { subscriptionStatus: "CANCELADA" } });
    await audit(req, "assinatura.cancelada");
    return { ok: true };
  });

  // Exclusão da conta: exige a senha. Contas comuns levam junto o próprio workspace (conversas, chatbots, chaves).
  app.post("/me/delete", { ...auth, config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } }, async (req, reply) => {
    const { password } = z.object({ password: z.string() }).parse(req.body);
    const u = await prisma.user.findUniqueOrThrow({ where: { id: req.user.id } });
    if (u.role === "PLATFORM_ADMIN") return reply.code(400).send({ error: "A conta de admin da plataforma não pode ser excluída por aqui." });
    if (!(await argon2.verify(u.passwordHash, password))) return reply.code(400).send({ error: "Senha incorreta." });
    const own = u.role === "CLIENT" ? await prisma.membership.findMany({ where: { userId: u.id }, select: { workspaceId: true } }) : [];
    await prisma.$transaction([
      prisma.workspace.deleteMany({ where: { id: { in: own.map((m) => m.workspaceId) } } }),
      prisma.membership.deleteMany({ where: { userId: u.id } }),
      prisma.managerInvite.deleteMany({ where: { managerId: u.id } }),
      prisma.user.delete({ where: { id: u.id } }),
    ]);
    await prisma.auditLog.create({ data: { action: "conta.excluida", ip: req.ip, meta: { userId: u.id } } });
    return { ok: true };
  });

  // ---- Gestor: vincular contas já cadastradas (por email). O dono da conta precisa aceitar.
  // Qualquer conta pode convidar outra conta existente (pelo email). A outra pessoa precisa aceitar.
  // Para ver conversas de terceiros, quem convida precisa ter o 2FA ativo.
  app.post("/managers/links", { ...mgr, config: { rateLimit: { max: 10, timeWindow: "1 hour" } } }, async (req, reply) => {
    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.user.id } });
    if (!me.totpEnabled) return reply.code(403).send({ error: "Ative o 2FA em Perfil > Conta antes de gerenciar outras contas." });
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const target = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    const ws = target && target.id !== me.id ? await ownWorkspace(target.id) : null;
    if (!ws || (NEED_IG && !ws.channels.some((c) => c.type === "INSTAGRAM"))) return reply.code(400).send({ error: GENERIC });
    const already = await prisma.membership.findUnique({ where: { userId_workspaceId: { userId: me.id, workspaceId: ws.id } } });
    if (already) return reply.code(400).send({ error: GENERIC });
    await prisma.managerInvite.upsert({
      where: { workspaceId_managerId: { workspaceId: ws.id, managerId: me.id } },
      update: { status: "PENDING" }, create: { workspaceId: ws.id, managerId: me.id },
    });
    await audit(req, "convite.gestao.enviado", ws.id);
    return { ok: true };
  });

  app.get("/managers/links", mgr, async (req) => {
    const inv = await prisma.managerInvite.findMany({
      where: { managerId: req.user.id }, orderBy: { createdAt: "desc" },
      include: { workspace: { include: { channels: true, members: { include: { user: true } } } } },
    });
    return inv.map((i) => ({
      id: i.id, status: i.status, nome: i.workspace.name,
      email: (i.workspace.members.find((m) => m.userId === i.workspace.ownerId) ?? i.workspace.members.find((m) => m.user.role === "CLIENT"))?.user.email,
      instagram: i.workspace.channels.find((c) => c.type === "INSTAGRAM")?.label ?? null,
    }));
  });

  app.delete("/managers/links/:id", mgr, async (req) => {
    const { id } = req.params as { id: string };
    const i = await prisma.managerInvite.findFirstOrThrow({ where: { id, managerId: req.user.id } });
    await prisma.membership.deleteMany({ where: { userId: req.user.id, workspaceId: i.workspaceId } });
    await prisma.managerInvite.delete({ where: { id } });
    await audit(req, "vinculo.gestao.removido", i.workspaceId);
    return { ok: true };
  });

  // ---- Dono da conta: aceitar, recusar ou revogar o acesso de um gestor
  async function mine(userId: string, id: string) {
    const i = await prisma.managerInvite.findFirst({ where: { id, workspace: ownedBy(userId) } });
    if (!i) throw Object.assign(new Error("não encontrado"), { statusCode: 404 });
    return i;
  }

  app.get("/me/invites", cli, async (req) => {
    const inv = await prisma.managerInvite.findMany({
      where: { status: { in: ["PENDING", "ACCEPTED"] }, workspace: ownedBy(req.user.id) }, orderBy: { createdAt: "desc" },
    });
    const users = await prisma.user.findMany({ where: { id: { in: inv.map((i) => i.managerId) } }, select: { id: true, name: true, email: true } });
    return inv.map((i) => { const m = users.find((u) => u.id === i.managerId); return { id: i.id, status: i.status, gestor: m?.name, email: m?.email }; });
  });

  app.post("/me/invites/:id/accept", cli, async (req) => {
    const i = await mine(req.user.id, (req.params as { id: string }).id);
    await prisma.$transaction([
      prisma.managerInvite.update({ where: { id: i.id }, data: { status: "ACCEPTED" } }),
      prisma.membership.upsert({ where: { userId_workspaceId: { userId: i.managerId, workspaceId: i.workspaceId } }, update: {}, create: { userId: i.managerId, workspaceId: i.workspaceId } }),
    ]);
    await audit(req, "convite.gestao.aceito", i.workspaceId);
    return { ok: true };
  });

  // recusa um convite pendente ou revoga um acesso já concedido
  app.post("/me/invites/:id/decline", cli, async (req) => {
    const i = await mine(req.user.id, (req.params as { id: string }).id);
    await prisma.membership.deleteMany({ where: { userId: i.managerId, workspaceId: i.workspaceId } });
    await prisma.managerInvite.update({ where: { id: i.id }, data: { status: "DECLINED" } });
    await audit(req, "convite.gestao.recusado", i.workspaceId);
    return { ok: true };
  });
}
