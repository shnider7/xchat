import nodemailer from "nodemailer";

// Sem SMTP_HOST configurado (desenvolvimento), o email aparece no log da API em vez de ser enviado.
const host = process.env.SMTP_HOST;
const tx = host ? nodemailer.createTransport({
  host, port: Number(process.env.SMTP_PORT ?? 587), secure: process.env.SMTP_SECURE === "true",
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
}) : null;

export async function sendMail(to: string, subject: string, text: string) {
  if (!tx) { console.log(`[email não configurado] Para: ${to}\n${subject}\n${text}`); return; }
  await tx.sendMail({ from: process.env.SMTP_FROM ?? process.env.SMTP_USER, to, subject, text });
}
