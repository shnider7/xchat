import argon2 from "argon2";
import { prisma } from "../db";

// uso: npm run create-admin -- email@dominio.com "senha-com-12+-caracteres"
async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password || password.length < 12) throw new Error("uso: create-admin <email> <senha com 12+ caracteres>");
  await prisma.user.create({ data: { email: email.toLowerCase(), name: "Admin", role: "PLATFORM_ADMIN", passwordHash: await argon2.hash(password, { type: argon2.argon2id }) } });
  console.log("Admin criado. Faça login e ative o 2FA em /auth/totp/setup.");
}
main().finally(() => prisma.$disconnect());
