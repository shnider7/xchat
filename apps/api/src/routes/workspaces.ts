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
  app.get("/workspaces", pre, (req) =>
    prisma.workspace.findMany({ where: { members: { some: { userId: req.user.id } } }, orderBy: { name: "asc" } }));

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
    }).parse(req.body);
    await audit(req, "workspace.editado", id, { campos: Object.keys(data) });
    return prisma.workspace.update({ where: { id }, data });
  });

  // Chats: sempre de UM workspace por vez, com auditoria
  app.get("/workspaces/:id/contacts", pre, async (req) => {
    const { id } = req.params as { id: string };
    await assertWorkspace(req, id);
    await audit(req, "chats.listados", id);
    return prisma.contact.findMany({ where: { workspaceId: id }, orderBy: { createdAt: "desc" }, include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } } });
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
