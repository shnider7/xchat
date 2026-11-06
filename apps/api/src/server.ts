import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { config } from "./config";
import { redis, registerBanGuard } from "./plugins/security";
import { adminRoutes } from "./routes/admin";
import { channelRoutes } from "./routes/channels";
import { chatbotRoutes } from "./routes/chatbots";
import { authRoutes } from "./routes/auth";
import { webhookRoutes } from "./routes/webhooks";
import { workspaceRoutes } from "./routes/workspaces";

const app = Fastify({ logger: true, trustProxy: true });
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
app.register(webhookRoutes);

app.listen({ port: config.port, host: "0.0.0.0" });
