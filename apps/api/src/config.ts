import "dotenv/config";
const need = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Variável ${k} é obrigatória`);
  return v;
};
export const config = {
  port: Number(process.env.PORT ?? 3333),
  panelUrl: process.env.PUBLIC_PANEL_URL ?? "http://localhost:3000",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  masterKey: need("MASTER_KEY"),
  jwtSecret: need("JWT_SECRET"),
  webhookSecret: need("WEBHOOK_SECRET"),
  evolutionUrl: process.env.EVOLUTION_URL ?? "",
  evolutionKey: process.env.EVOLUTION_API_KEY ?? "",
  maxRps: Number(process.env.MAX_RPS ?? 20),
};
