import { NextRequest, NextResponse } from "next/server";
const API = process.env.API_URL ?? "http://localhost:3333";

export async function POST(req: NextRequest) {
  let res: Response;
  try {
    res = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": req.headers.get("x-forwarded-for") ?? "" },
      body: await req.text(),
    });
  } catch {
    return NextResponse.json({ error: "Servidor da API fora do ar. Tente novamente em instantes." }, { status: 503 });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return NextResponse.json({ error: data.error ?? "falha no login" }, { status: res.status });
  const base = { sameSite: "strict" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 900 };

  // 2FA ativo: guarda o bilhete em cookie httpOnly (5 min) e pede o código
  if (data.need2fa) {
    const out = NextResponse.json({ need2fa: true });
    out.cookies.set("ticket", data.ticket, { ...base, httpOnly: true, maxAge: 300 });
    return out;
  }
  const out = NextResponse.json({ role: data.role, precisaAtivar2FA: data.precisaAtivar2FA });
  out.cookies.set("token", data.token, { ...base, httpOnly: true });
  out.cookies.set("role", data.role, base);
  return out;
}
