import { cookies } from "next/headers";
import { NextRequest } from "next/server";
const API = process.env.API_URL ?? "http://localhost:3333";

async function handler(req: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params.path.join("/");
  if (path.startsWith("auth/login")) return new Response("{}", { status: 404 }); // login só por /api/login
  const token = cookies().get("token")?.value;
  const body = ["GET", "HEAD"].includes(req.method) ? "" : await req.text();

  const headers: Record<string, string> = { "x-forwarded-for": req.headers.get("x-forwarded-for") ?? "" };
  if (body) headers["Content-Type"] = "application/json"; // só declara JSON quando há conteúdo
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API}/${path}${req.nextUrl.search}`, { method: req.method, headers, body: body || undefined });
  } catch {
    return Response.json({ error: "API fora do ar" }, { status: 503 });
  }
  return new Response(await res.text(), { status: res.status, headers: { "Content-Type": "application/json" } });
}
export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };