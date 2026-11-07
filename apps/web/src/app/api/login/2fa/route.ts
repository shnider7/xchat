import { NextRequest, NextResponse } from "next/server";
const API = process.env.API_URL ?? "http://localhost:3333";

export async function POST(req: NextRequest) {
  const ticket = req.cookies.get("ticket")?.value;
  if (!ticket) return NextResponse.json({ error: "Sessão expirada. Entre de novo." }, { status: 401 });
  const { code } = await req.json().catch(() => ({ code: "" }));
  let res: Response;
  try {
    res = await fetch(`${API}/auth/2fa`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": req.headers.get("x-forwarded-for") ?? "" },
      body: JSON.stringify({ ticket, code }),
    });
  } catch {
    return NextResponse.json({ error: "Servidor da API fora do ar." }, { status: 503 });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return NextResponse.json({ error: data.error ?? "Código inválido." }, { status: res.status });
  const base = { sameSite: "strict" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 900 };
  const out = NextResponse.json({ role: data.role, precisaAtivar2FA: false });
  out.cookies.set("token", data.token, { ...base, httpOnly: true });
  out.cookies.set("role", data.role, base);
  out.cookies.delete("ticket");
  return out;
}
