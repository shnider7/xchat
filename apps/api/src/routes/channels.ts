import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db";
import { assertWorkspace, audit, guard } from "../services/access";
import { encrypt } from "../services/crypto";
import { getMe, subscribe } from "../services/instagram";

export async function channelRoutes(app: FastifyInstance) {
  const pre = { preHandler: guard(["MANAGER", "CLIENT"]) };

  app.get("/workspaces/:id/channels", pre, async (req) => {
    const { id } = req.params as { id: string };
    await assertWorkspace(req, id);
    return prisma.channelConnection.findMany({ where: { workspaceId: id }, select: { id: true, type: true, label: true, externalId: true, createdAt: true } });
  });

  // Conecta o Instagram só com o token (Instagram Login): descobre a conta, guarda o token criptografado e liga os avisos (webhook).
  app.post("/workspaces/:id/channels/instagram", pre, async (req, reply) => {
    const { id } = req.params as { id: string };
    await assertWorkspace(req, id);
    const b = z.object({ accessToken: z.string().min(20).max(1000) }).parse(req.body);
    let me: any;
    try { me = await getMe(b.accessToken); } catch { return reply.code(400).send({ error: "Não foi possível validar o token no Instagram. Gere um token novo no painel do app da Meta." }); }
    const igId = String(me.user_id ?? me.id);
    // 1 Instagram por conta, e cada Instagram em uma única conta
    const existing = await prisma.channelConnection.findFirst({ where: { type: "INSTAGRAM", OR: [
      { workspaceId: id, NOT: { externalId: igId } }, { externalId: igId, NOT: { workspaceId: id } }] } });
    if (existing) return reply.code(409).send({ error: "Cada conta pode ter apenas 1 Instagram, e cada Instagram só pode ficar em uma conta." });
    const label = me.username ? `@${me.username}` : igId;
    const c = await prisma.channelConnection.upsert({
      where: { workspaceId_type_externalId: { workspaceId: id, type: "INSTAGRAM", externalId: igId } },
      update: { tokenEnc: encrypt(b.accessToken), label }, create: { workspaceId: id, type: "INSTAGRAM", externalId: igId, label, tokenEnc: encrypt(b.accessToken) },
    });
    let webhook = true;
    try { await subscribe({ igId, token: b.accessToken }); } catch { webhook = false; }
    await audit(req, "canal.instagram.conectado", id, { webhook });
    return { id: c.id, label: c.label, webhook };
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
