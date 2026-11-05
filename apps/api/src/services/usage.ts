import { prisma } from "../db";
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
