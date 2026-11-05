import { NextResponse } from "next/server";
export async function POST() {
  const out = NextResponse.json({ ok: true });
  out.cookies.delete("token");
  out.cookies.delete("role");
  return out;
}
