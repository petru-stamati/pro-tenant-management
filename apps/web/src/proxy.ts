import { NextRequest, NextResponse } from "next/server";

/**
 * Optimistic role-based routing only — reads the lightweight `pt_role`
 * cookie set by AuthProvider after login, never the real access token
 * (which never leaves memory). This is UX convenience, not a security
 * boundary: every actual authorization check happens server-side in the
 * NestJS API, per the Next.js auth guide's own "optimistic checks" guidance.
 */
const ROLE_HOME: Record<string, string> = {
  ADMIN: "/pm",
  OWNER: "/owner",
  TENANT: "/tenant",
};

const SECTION_PREFIX: Record<string, string> = {
  ADMIN: "/pm",
  OWNER: "/owner",
  TENANT: "/tenant",
};

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const role = request.cookies.get("pt_role")?.value;

  const isAppRoute = pathname.startsWith("/pm") || pathname.startsWith("/owner") || pathname.startsWith("/tenant");
  const isLoginRoute = pathname === "/login";

  if (isAppRoute && !role) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAppRoute && role && !pathname.startsWith(SECTION_PREFIX[role] ?? "/login")) {
    return NextResponse.redirect(new URL(ROLE_HOME[role] ?? "/login", request.url));
  }

  if ((pathname === "/" || isLoginRoute) && role) {
    return NextResponse.redirect(new URL(ROLE_HOME[role] ?? "/login", request.url));
  }

  if (pathname === "/" && !role) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
