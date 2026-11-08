import { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../db";

export type RoleName = "PLATFORM_ADMIN" | "MANAGER" | "CLIENT";
declare module "@fastify/jwt" {
  interface FastifyJWT { user: { id: string; role: RoleName; mfa: boolean } }
}

// Autentica, confere papel e (para contas comuns) se a conta está ativa. Só o admin da plataforma exige 2FA.
// O vencimento NUNCA bloqueia sozinho: quem liga e desliga é o admin.
export const guard = (roles?: RoleName[], allowNoMfa = false, allowInactive = false) =>
  async (req: FastifyRequest, reply: FastifyReply) => {
    try { await req.jwtVerify(); } catch { return reply.code(401).send({ error: "não autenticado" }); }
    const u = req.user;
    if ((u as any).purpose) return reply.code(401).send({ error: "não autenticado" }); // bilhete de 2FA não vale como sessão
    if (roles && !roles.includes(u.role)) return reply.code(403).send({ error: "sem permissão" });
    if (u.role === "PLATFORM_ADMIN" && !u.mfa && !allowNoMfa) return reply.code(403).send({ error: "2FA obrigatório" });
    if (u.role !== "PLATFORM_ADMIN" && !allowInactive) {
      const row = await prisma.user.findUnique({ where: { id: u.id }, select: { active: true } });
      if (!row?.active) return reply.code(403).send({ error: "Sua conta ainda não foi ativada. Aguarde a liberação." });
    }
  };

// O admin geral NUNCA acessa workspaces/chats. Os demais só acessam os vinculados a eles.
export async function assertWorkspace(req: FastifyRequest, workspaceId: string) {
  const u = req.user;
  if (u.role === "PLATFORM_ADMIN") throw Object.assign(new Error("sem permissão"), { statusCode: 403 });
  const m = await prisma.membership.findUnique({ where: { userId_workspaceId: { userId: u.id, workspaceId } } });
  if (!m) throw Object.assign(new Error("sem permissão"), { statusCode: 403 });
}

export function audit(req: FastifyRequest, action: string, workspaceId?: string, meta?: object) {
  return prisma.auditLog.create({
    data: { userId: req.user?.id, workspaceId, action, ip: req.ip, meta: meta as any },
  }).catch(() => undefined);
}
