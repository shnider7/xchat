import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db";
import { assertWorkspace, audit, guard } from "../services/access";
import { makeCtx, run, toGraph } from "../services/flow";

const gnode = z.object({
  id: z.string().min(1).max(40), type: z.enum(["start", "message", "question", "condition", "action", "ai"]),
  position: z.object({ x: z.number(), y: z.number() }), data: z.record(z.any()),
}).refine((n) => JSON.stringify(n.data).length < 6000, "passo grande demais");
const graph = z.object({
  v: z.literal(2), nodes: z.array(gnode).max(80),
  edges: z.array(z.object({ id: z.string().max(120).optional(), source: z.string().max(40), sourceHandle: z.string().max(40).nullable().optional(), target: z.string().max(40) })).max(250),
});
const body = z.object({ name: z.string().min(1).max(80), active: z.boolean().optional(), flow: graph });
const triggerOf = (f: z.infer<typeof graph>) => String(f.nodes.find((n) => n.type === "start")?.data?.trigger ?? "").slice(0, 60) || null;

export async function chatbotRoutes(app: FastifyInstance) {
  const pre = { preHandler: guard(["MANAGER", "CLIENT"]) };

  app.get("/workspaces/:id/chatbots", pre, async (req) => {
    const { id } = req.params as { id: string };
    await assertWorkspace(req, id);
    const bots = await prisma.chatbot.findMany({ where: { workspaceId: id }, orderBy: { createdAt: "asc" } });
    return bots.map((b) => ({ id: b.id, name: b.name, active: b.active, flow: toGraph(b.nodes) }));
  });

  app.post("/workspaces/:id/chatbots", pre, async (req) => {
    const { id } = req.params as { id: string };
    await assertWorkspace(req, id);
    const b = body.parse(req.body);
    const c = await prisma.chatbot.create({ data: { workspaceId: id, name: b.name, trigger: triggerOf(b.flow), active: b.active ?? true, nodes: b.flow } });
    await audit(req, "chatbot.criado", id);
    return { id: c.id };
  });

  app.patch("/chatbots/:id", pre, async (req) => {
    const { id } = req.params as { id: string };
    const c = await prisma.chatbot.findUniqueOrThrow({ where: { id } });
    await assertWorkspace(req, c.workspaceId);
    const b = body.partial().parse(req.body);
    await audit(req, "chatbot.editado", c.workspaceId);
    await prisma.chatbot.update({ where: { id }, data: { ...(b.name && { name: b.name }), ...(b.active !== undefined && { active: b.active }), ...(b.flow && { nodes: b.flow, trigger: triggerOf(b.flow) }) } });
    return { id };
  });

  app.delete("/chatbots/:id", pre, async (req) => {
    const { id } = req.params as { id: string };
    const c = await prisma.chatbot.findUniqueOrThrow({ where: { id } });
    await assertWorkspace(req, c.workspaceId);
    await prisma.chatbot.delete({ where: { id } });
    await audit(req, "chatbot.removido", c.workspaceId);
    return { ok: true };
  });

  // Teste sem nenhum canal conectado (usa a chave de IA do cliente, se houver)
  app.post("/workspaces/:id/chatbot-simulate", { ...pre, config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (req) => {
    const { id } = req.params as { id: string };
    await assertWorkspace(req, id);
    const b = z.object({
      flow: graph, message: z.string().max(1000).nullable(),
      state: z.object({ cur: z.string().nullable(), vars: z.record(z.string()), tags: z.array(z.string()).default([]), wait: z.enum(["button", "answer", "ai"]).optional(), aiTurns: z.number().optional(), done: z.boolean().optional() }),
      history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) })).max(30).default([]),
    }).parse(req.body);
    const ws = await prisma.workspace.findUniqueOrThrow({ where: { id } });
    return run(b.flow, b.state, b.message, makeCtx(ws, b.history));
  });
}
