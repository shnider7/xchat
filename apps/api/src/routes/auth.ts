import argon2 from "argon2";
import { authenticator } from "otplib";
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { config } from "../config";
import { prisma } from "../db";
import { createHash, randomBytes } from "crypto";
import { redis } from "../plugins/security";
import { sendMail } from "../services/mailer";
import { passwordRule } from "../services/password";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
import { audit, guard } from "../services/access";
import { decrypt, encrypt } from "../services/crypto";

export async function authRoutes(app: FastifyInstance) {
  // O painel só mostra "Criar conta" quando o cadastro está ligado
  app.get("/auth/config", async () => ({ signup: config.signupEnabled }));

  // Cadastro aberto: cria SEMPRE um usuário CLIENT com o próprio workspace (nunca admin ou gestor)
  app.post("/auth/register", { config: { rateLimit: { max: 3, timeWindow: "1 hour" } } }, async (req, reply) => {
    if (!config.signupEnabled) return reply.code(403).send({ error: "cadastro desativado" });
    const b = z.object({ name: z.string().min(2).max(80), email: z.string().email(), password: passwordRule }).parse(req.body);
    const email = b.email.toLowerCase();
    if (await prisma.user.findUnique({ where: { email } })) return reply.code(409).send({ error: "não foi possível criar a conta com esses dados" });
    // Conta nova nasce DESATIVADA: o admin libera manualmente. Ela já ganha o próprio espaço de trabalho.
    const u = await prisma.user.create({ data: { email, name: b.name, role: "CLIENT", active: false, passwordHash: await argon2.hash(b.password, { type: argon2.argon2id }) } });
    await prisma.workspace.create({ data: { name: b.name, ownerId: u.id, members: { create: { userId: u.id } } } });
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
    if (u.totpEnabled) {
      // 2FA ativo: a senha sozinha não abre a sessão. Devolve um bilhete curto para a etapa do código.
      await prisma.auditLog.create({ data: { userId: u.id, action: "login.senha_ok", ip: req.ip } });
      return { need2fa: true, ticket: app.jwt.sign({ id: u.id, purpose: "2fa" }, { expiresIn: "5m" }) };
    }
    const token = app.jwt.sign({ id: u.id, role: u.role, mfa: false });
    await prisma.auditLog.create({ data: { userId: u.id, action: "login.ok", ip: req.ip } });
    return { token, role: u.role, precisaAtivar2FA: u.role === "PLATFORM_ADMIN" && !u.totpEnabled };
  });

  // Recuperação de senha: a resposta é sempre a mesma, exista ou não o email
  app.post("/auth/forgot", { config: { rateLimit: { max: 5, timeWindow: "1 hour" } } }, async (req) => {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const u = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (u) {
      const token = randomBytes(32).toString("base64url");
      await redis.set(`pwreset:${sha(token)}`, u.id, "EX", 1800);
      const link = `${config.panelUrl}/redefinir?token=${token}`;
      void sendMail(u.email, "Redefinir sua senha", `Olá, ${u.name}!\n\nUse este link (vale por 30 minutos) para criar uma nova senha:\n${link}\n\nSe não foi você, ignore este email.`).catch(() => {});
      await prisma.auditLog.create({ data: { userId: u.id, action: "senha.recuperacao.pedida", ip: req.ip } });
    }
    return { ok: true };
  });

  app.post("/auth/reset", { config: { rateLimit: { max: 10, timeWindow: "1 hour" } } }, async (req, reply) => {
    const b = z.object({ token: z.string().min(20).max(100), password: passwordRule }).parse(req.body);
    const key = `pwreset:${sha(b.token)}`;
    const id = await redis.get(key);
    if (!id) return reply.code(400).send({ error: "Link inválido ou expirado. Peça um novo." });
    await prisma.user.update({ where: { id }, data: { passwordHash: await argon2.hash(b.password, { type: argon2.argon2id }) } });
    await redis.del(key);
    await prisma.auditLog.create({ data: { userId: id, action: "senha.redefinida", ip: req.ip } });
    return { ok: true };
  });

  // Etapa 2 do login: confere o código do app autenticador. Bloqueia após 5 erros em 10 minutos.
  app.post("/auth/2fa", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req, reply) => {
    const b = z.object({ ticket: z.string(), code: z.string().regex(/^\d{6}$/) }).parse(req.body);
    let t: any;
    try { t = app.jwt.verify(b.ticket); } catch { return reply.code(401).send({ error: "Sessão expirada. Entre de novo." }); }
    if (t.purpose !== "2fa") return reply.code(401).send({ error: "Sessão expirada. Entre de novo." });
    const key = `2fa:fail:${t.id}`;
    if (Number((await redis.get(key)) ?? 0) >= 5) return reply.code(429).send({ error: "Muitas tentativas. Aguarde alguns minutos." });
    const u = await prisma.user.findUnique({ where: { id: t.id } });
    if (!u || !u.totpEnabled || !u.totpSecretEnc || !authenticator.check(b.code, decrypt(u.totpSecretEnc))) {
      await redis.incr(key); await redis.expire(key, 600);
      await prisma.auditLog.create({ data: { userId: t.id, action: "2fa.falha", ip: req.ip } });
      return reply.code(401).send({ error: "Código inválido." });
    }
    await redis.del(key);
    await prisma.auditLog.create({ data: { userId: u.id, action: "login.ok", ip: req.ip } });
    return { token: app.jwt.sign({ id: u.id, role: u.role, mfa: true }), role: u.role, precisaAtivar2FA: false };
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
