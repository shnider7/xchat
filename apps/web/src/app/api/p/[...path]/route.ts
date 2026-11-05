import { cookies } from "next/headers";
import { NextRequest } from "next/server";
const API = process.env.API_URL ?? "http://localhost:3333";

async function handler(req: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params.path.join("/");
  if (path.startsWith("auth/login")) return new Response("{}", { status: 404 }); // login só por /api/login
  const token = cookies().get("token")?.value;
  const res = await fetch(`${API}/${path}${req.nextUrl.search}`, {
    method: req.method,
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": req.headers.get("x-forwarded-for") ?? "",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.text(),
  });
  return new Response(await res.text(), { status: res.status, headers: { "Content-Type": "application/json" } });
}
export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };
