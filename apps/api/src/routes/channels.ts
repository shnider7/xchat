import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db";
import { assertWorkspace, audit, guard } from "../services/access";
import { encrypt } from "../services/crypto";

const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION ?? "v21.0"}`;

export async function channelRoutes(app: FastifyInstance) {
  const pre = { preHandler: guard(["MANAGER", "CLIENT"]) };

  app.get("/workspaces/:id/channels", pre, async (req) => {
    const { id } = req.params as { id: string };
    await assertWorkspace(req, id);
    return prisma.channelConnection.findMany({ where: { workspaceId: id }, select: { id: true, type: true, label: true, externalId: true, createdAt: true } });
  });

  // Conexão manual: ID da conta profissional do Instagram + token. O token é validado e guardado criptografado.
  app.post("/workspaces/:id/channels/instagram", pre, async (req, reply) => {
    const { id } = req.params as { id: string };
    await assertWorkspace(req, id);
    const b = z.object({ igUserId: z.string().regex(/^\d{5,30}$/), accessToken: z.string().min(20).max(1000) }).parse(req.body);
    // 1 Instagram por conta, e cada Instagram em uma única conta
    const existing = await prisma.channelConnection.findFirst({ where: { type: "INSTAGRAM", OR: [
      { workspaceId: id, NOT: { externalId: b.igUserId } }, { externalId: b.igUserId, NOT: { workspaceId: id } }] } });
    if (existing) return reply.code(409).send({ error: "Cada conta pode ter apenas 1 Instagram, e cada Instagram só pode ficar em uma conta." });
    const r = await fetch(`${GRAPH}/${b.igUserId}?fields=username`, { headers: { Authorization: `Bearer ${b.accessToken}` } }).catch(() => null);
    if (!r?.ok) return reply.code(400).send({ error: "Não foi possível validar o ID e o token no Instagram." });
    const { username } = (await r.json()) as { username?: string };
    const label = username ? `@${username}` : b.igUserId;
    const c = await prisma.channelConnection.upsert({
      where: { workspaceId_type_externalId: { workspaceId: id, type: "INSTAGRAM", externalId: b.igUserId } },
      update: { tokenEnc: encrypt(b.accessToken), label },
      create: { workspaceId: id, type: "INSTAGRAM", externalId: b.igUserId, label, tokenEnc: encrypt(b.accessToken) },
    });
    await audit(req, "canal.instagram.conectado", id);
    return { id: c.id, label: c.label };
  });

  app.delete("/channels/:id", pre, async (req) => {
    const { id } = req.params as { id: string };
    const c = await prisma.channelConnection.findUniqueOrThrow({ where: { id } });
    await assertWorkspace(req, c.workspaceId);
    await prisma.channelConnection.delete({ where: { id } });
    await audit(req, "canal.removido", c.workspaceId, { type: c.type });
    return { ok: true };
  });
}
