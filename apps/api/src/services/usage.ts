import { prisma } from "../db";
import { estimateBrl } from "./pricing";
const month = () => new Date().toISOString().slice(0, 7);

export function getUsage(workspaceId: string) {
  return prisma.usageCounter.upsert({
    where: { workspaceId_month: { workspaceId, month: month() } },
    update: {}, create: { workspaceId, month: month() },
  });
}
export function bump(workspaceId: string, field: "aiCalls" | "messages") {
  return prisma.usageCounter.upsert({
    where: { workspaceId_month: { workspaceId, month: month() } },
    update: { [field]: { increment: 1 } }, create: { workspaceId, month: month(), [field]: 1 },
  });
}

// Guarda tokens e o custo estimado de cada chamada de IA
export async function recordUsage(ws: { id: string; aiProvider: string; aiModel: string }, tokensIn: number, tokensOut: number) {
  await prisma.usageEvent.create({
    data: { workspaceId: ws.id, provider: ws.aiProvider, model: ws.aiModel, inputTokens: tokensIn, outputTokens: tokensOut, costBrl: estimateBrl(ws.aiModel, tokensIn, tokensOut) },
  }).catch(() => undefined);
}
