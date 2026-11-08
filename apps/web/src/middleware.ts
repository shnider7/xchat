import { NextRequest, NextResponse } from "next/server";
// Sem cookie de sessão, qualquer página (exceto login e cadastro) volta para o login
const PUBLIC = ["/login", "/cadastro", "/redefinir", "/privacidade", "/termos"];
export function middleware(req: NextRequest) {
  if (!req.cookies.get("token") && !PUBLIC.includes(req.nextUrl.pathname)) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}
export const config = { matcher: ["/((?!api|_next|.*\\..*).*)"] };
