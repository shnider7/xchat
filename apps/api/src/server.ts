import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { ZodError } from "zod";
import { config } from "./config";
import { redis, registerBanGuard } from "./plugins/security";
import { adminRoutes } from "./routes/admin";
import { channelRoutes } from "./routes/channels";
import { chatbotRoutes } from "./routes/chatbots";
import { authRoutes } from "./routes/auth";
import { profileRoutes } from "./routes/profile";
import { aiModelRoutes } from "./routes/aimodels";
import { instagramWebhookRoutes } from "./routes/instagram";
import { webhookRoutes } from "./routes/webhooks";
import { workspaceRoutes } from "./routes/workspaces";

const app = Fastify({ logger: true, trustProxy: true });
app.setErrorHandler((err, _req, reply) => {
  if (err instanceof ZodError) {
    const m = err.issues[0]?.message;
    return reply.code(400).send({ error: m && !/^(Invalid|Required|String must|Expected)/.test(m) ? m : "Dados inválidos. Confira os campos." });
  }
  const code = (err as any).statusCode ?? 500;
  if (code >= 500) app.log.error(err);
  reply.code(code).send({ error: code === 429 ? "Muitas tentativas. Aguarde um pouco e tente de novo." : code >= 500 ? "Erro interno." : err.message });
});
app.register(helmet);
app.register(cors, { origin: config.panelUrl });
app.register(jwt, { secret: config.jwtSecret, sign: { expiresIn: "15m" } });
app.register(rateLimit, { max: 300, timeWindow: "1 minute", redis });
registerBanGuard(app);

app.get("/health", async () => ({ ok: true }));
app.register(authRoutes);
app.register(adminRoutes);
app.register(workspaceRoutes);
app.register(chatbotRoutes);
app.register(channelRoutes);
app.register(profileRoutes);
app.register(webhookRoutes);
app.register(instagramWebhookRoutes);
app.register(aiModelRoutes);

app.listen({ port: config.port, host: "0.0.0.0" });
