import argon2 from "argon2";
import { authenticator } from "otplib";
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { config } from "../config";
import { prisma } from "../db";
import { audit, guard } from "../services/access";
import { decrypt, encrypt } from "../services/crypto";

export async function authRoutes(app: FastifyInstance) {
  // O painel só mostra "Criar conta" quando o cadastro está ligado
  app.get("/auth/config", async () => ({ signup: config.signupEnabled }));

  // Cadastro aberto: cria SEMPRE um usuário CLIENT com o próprio workspace (nunca admin ou gestor)
  app.post("/auth/register", { config: { rateLimit: { max: 3, timeWindow: "1 hour" } } }, async (req, reply) => {
    if (!config.signupEnabled) return reply.code(403).send({ error: "cadastro desativado" });
    const b = z.object({ name: z.string().min(2).max(80), email: z.string().email(), password: z.string().min(12).max(128) }).parse(req.body);
    const email = b.email.toLowerCase();
    if (await prisma.user.findUnique({ where: { email } })) return reply.code(409).send({ error: "não foi possível criar a conta com esses dados" });
    const u = await prisma.user.create({
      data: {
        email, name: b.name, role: "CLIENT", passwordHash: await argon2.hash(b.password, { type: argon2.argon2id }),
        memberships: { create: { workspace: { create: { name: b.name } } } },
      },
    });
    await prisma.auditLog.create({ data: { userId: u.id, action: "conta.criada", ip: req.ip } });
    return { ok: true };
  });

  app.post("/auth/login", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (req, reply) => {
    const b = z.object({ email: z.string().email(), password: z.string(), totp: z.string().optional() }).parse(req.body);
    const u = await prisma.user.findUnique({ where: { email: b.email.toLowerCase() } });
    const ok = u && (await argon2.verify(u.passwordHash, b.password));
    if (!u || !ok) {
      await prisma.auditLog.create({ data: { action: "login.falha", ip: req.ip, meta: { email: b.email } } });
      return reply.code(401).send({ error: "credenciais inválidas" });
    }
    if (u.totpEnabled && (!b.totp || !authenticator.check(b.totp, decrypt(u.totpSecretEnc!)))) {
      return reply.code(401).send({ error: "código 2FA inválido" });
    }
    const token = app.jwt.sign({ id: u.id, role: u.role, mfa: u.totpEnabled });
    await prisma.auditLog.create({ data: { userId: u.id, action: "login.ok", ip: req.ip } });
    return { token, role: u.role, precisaAtivar2FA: u.role !== "CLIENT" && !u.totpEnabled };
  });

  // 1) gera o segredo e devolve a URL para o app autenticador (QR no front)
  app.post("/auth/totp/setup", { preHandler: guard(undefined, true) }, async (req) => {
    const u = await prisma.user.findUniqueOrThrow({ where: { id: req.user.id } });
    const secret = authenticator.generateSecret();
    await prisma.user.update({ where: { id: u.id }, data: { totpSecretEnc: encrypt(secret), totpEnabled: false } });
    return { otpauthUrl: authenticator.keyuri(u.email, "ChatFlow", secret) };
  });

  // 2) confirma com um código; depois é preciso fazer login de novo
  app.post("/auth/totp/enable", { preHandler: guard(undefined, true) }, async (req, reply) => {
    const { code } = z.object({ code: z.string() }).parse(req.body);
    const u = await prisma.user.findUniqueOrThrow({ where: { id: req.user.id } });
    if (!u.totpSecretEnc || !authenticator.check(code, decrypt(u.totpSecretEnc))) return reply.code(400).send({ error: "código inválido" });
    await prisma.user.update({ where: { id: u.id }, data: { totpEnabled: true } });
    await audit(req, "2fa.ativado");
    return { ok: true, aviso: "faça login novamente com o código 2FA" };
  });
}
