import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db";
import { assertWorkspace, audit, guard } from "../services/access";
import { makeCtx, run } from "../services/flow";

const node = z.object({
  id: z.string().min(1).max(30), type: z.enum(["message", "question", "options", "ai", "lead"]),
  text: z.string().max(1000).optional(), save: z.string().regex(/^\w{1,30}$/).optional(),
  options: z.array(z.object({ label: z.string().min(1).max(60), goto: z.string().max(30).optional() })).max(10).optional(),
  prompt: z.string().max(2000).optional(), turns: z.number().int().min(1).max(10).optional(),
});
const body = z.object({ name: z.string().min(1).max(80), trigger: z.string().max(60).nullable().optional(), active: z.boolean().optional(), nodes: z.array(node).max(50) });

export async function chatbotRoutes(app: FastifyInstance) {
  const pre = { preHandler: guard(["MANAGER", "CLIENT"]) };

  app.get("/workspaces/:id/chatbots", pre, async (req) => {
    const { id } = req.params as { id: string };
    await assertWorkspace(req, id);
    return prisma.chatbot.findMany({ where: { workspaceId: id }, orderBy: { createdAt: "asc" } });
  });

  app.post("/workspaces/:id/chatbots", pre, async (req) => {
    const { id } = req.params as { id: string };
    await assertWorkspace(req, id);
    const b = body.parse(req.body);
    const c = await prisma.chatbot.create({ data: { workspaceId: id, name: b.name, trigger: b.trigger || null, active: b.active ?? true, nodes: b.nodes } });
    await audit(req, "chatbot.criado", id);
    return c;
  });

  app.patch("/chatbots/:id", pre, async (req) => {
    const { id } = req.params as { id: string };
    const c = await prisma.chatbot.findUniqueOrThrow({ where: { id } });
    await assertWorkspace(req, c.workspaceId);
    const b = body.partial().parse(req.body);
    await audit(req, "chatbot.editado", c.workspaceId);
    return prisma.chatbot.update({ where: { id }, data: { ...(b.name && { name: b.name }), ...(b.trigger !== undefined && { trigger: b.trigger || null }), ...(b.active !== undefined && { active: b.active }), ...(b.nodes && { nodes: b.nodes }) } });
  });

  app.delete("/chatbots/:id", pre, async (req) => {
    const { id } = req.params as { id: string };
    const c = await prisma.chatbot.findUniqueOrThrow({ where: { id } });
    await assertWorkspace(req, c.workspaceId);
    await prisma.chatbot.delete({ where: { id } });
    await audit(req, "chatbot.removido", c.workspaceId);
    return { ok: true };
  });

  // Simulador: testa o fluxo sem nenhum canal conectado (usa a chave de IA do cliente, se houver)
  app.post("/workspaces/:id/chatbot-simulate", { ...pre, config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (req) => {
    const { id } = req.params as { id: string };
    await assertWorkspace(req, id);
    const b = z.object({
      nodes: z.array(node).max(50), message: z.string().max(1000).nullable(),
      state: z.object({ idx: z.number(), vars: z.record(z.string()), wait: z.enum(["answer", "ai"]).optional(), aiTurns: z.number().optional(), done: z.boolean().optional() }).default({ idx: 0, vars: {} }),
      history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) })).max(30).default([]),
    }).parse(req.body);
    const ws = await prisma.workspace.findUniqueOrThrow({ where: { id } });
    return run(b.nodes, b.state, b.message, makeCtx(ws, b.history));
  });
}
