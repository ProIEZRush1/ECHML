import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secretKey = new TextEncoder().encode(
  process.env.SESSION_SECRET || "dev-fallback-secret-do-not-use-in-prod"
);

const PUBLIC_PATHS = ["/login", "/setup", "/api/auth/login", "/api/auth/setup", "/api/ml/webhook", "/api/ml/auth/callback", "/api/health"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // API routes with Bearer token (API key) — let them through, the route handler validates
  if (pathname.startsWith("/api/") && request.headers.get("authorization")?.startsWith("Bearer ech_")) {
    return NextResponse.next();
  }

  const token = request.cookies.get("echml-session")?.value;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    await jwtVerify(token, secretKey);
    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sesion expirada" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images).*)"],
};
