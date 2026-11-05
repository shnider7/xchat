import { NextRequest, NextResponse } from "next/server";
const API = process.env.API_URL ?? "http://localhost:3333";

export async function POST(req: NextRequest) {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": req.headers.get("x-forwarded-for") ?? "" },
    body: await req.text(),
  });
  const data = await res.json();
  if (!res.ok) return NextResponse.json({ error: data.error ?? "falha no login" }, { status: res.status });
  const out = NextResponse.json({ role: data.role, precisaAtivar2FA: data.precisaAtivar2FA });
  const base = { sameSite: "strict" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 900 };
  out.cookies.set("token", data.token, { ...base, httpOnly: true });
  out.cookies.set("role", data.role, base); // só para o visual do menu; a API é quem manda nas permissões
  return out;
}
