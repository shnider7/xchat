import { FastifyInstance } from "fastify";
import Redis from "ioredis";
import { config } from "../config";

export const redis = new Redis(config.redisUrl);

// Bloqueio automático: acima de MAX_RPS por segundo, o IP é banido (tempo cresce a cada reincidência)
export function registerBanGuard(app: FastifyInstance) {
  app.addHook("onRequest", async (req, reply) => {
    if (req.url.startsWith("/webhooks") || req.url === "/health") return;
    const ip = req.ip;
    if (await redis.exists(`ban:${ip}`)) return reply.code(429).send({ error: "bloqueado temporariamente" });
    const k = `rps:${ip}:${Math.floor(Date.now() / 1000)}`;
    const n = await redis.incr(k);
    if (n === 1) await redis.expire(k, 2);
    if (n > config.maxRps) {
      const strikes = await redis.incr(`strikes:${ip}`);
      await redis.expire(`strikes:${ip}`, 86400);
      const ttl = Math.min(60 * 5 ** Math.min(strikes - 1, 4), 86400); // 1min, 5min, 25min... até 24h
      await redis.set(`ban:${ip}`, "1", "EX", ttl);
      app.log.warn({ ip, strikes, ttl }, "IP bloqueado por excesso de requisições");
      return reply.code(429).send({ error: "bloqueado temporariamente" });
    }
  });
}
