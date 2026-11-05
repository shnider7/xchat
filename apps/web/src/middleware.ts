import { NextRequest, NextResponse } from "next/server";
// Sem cookie de sessão, qualquer página (exceto /login) volta para o login
export function middleware(req: NextRequest) {
  if (!req.cookies.get("token") && req.nextUrl.pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}
export const config = { matcher: ["/((?!api|_next|favicon.ico).*)"] };
