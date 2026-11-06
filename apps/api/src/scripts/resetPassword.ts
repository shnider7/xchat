import argon2 from "argon2";
import { prisma } from "../db";

// uso: npx tsx src/scripts/resetPassword.ts <email> '<nova senha 12+ caracteres>' [sem2fa]
async function main() {
  const [email, password, flag] = process.argv.slice(2);
  if (!email || !password || password.length < 12) throw new Error("uso: resetPassword <email> '<senha com 12+ caracteres>' [sem2fa]");
  const u = await prisma.user.update({
    where: { email: email.toLowerCase() },
    data: {
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      ...(flag === "sem2fa" && { totpEnabled: false, totpSecretEnc: null }),
    },
  });
  console.log("Senha redefinida para", u.email);
}
main().finally(() => prisma.$disconnect());
