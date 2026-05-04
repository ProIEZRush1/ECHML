import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/ml/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    console.error("ML OAuth error:", error);
    return NextResponse.redirect(
      new URL("/configuracion/mercadolibre?error=auth_denied", request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/configuracion/mercadolibre?error=no_code", request.url)
    );
  }

  try {
    const redirectUri = `${request.nextUrl.origin}/api/ml/auth/callback`;
    await exchangeCodeForToken(code, redirectUri);

    return NextResponse.redirect(
      new URL("/dashboard?ml=connected", request.url)
    );
  } catch (e) {
    console.error("ML token exchange error:", e);
    return NextResponse.redirect(
      new URL("/configuracion/mercadolibre?error=token_exchange", request.url)
    );
  }
}
