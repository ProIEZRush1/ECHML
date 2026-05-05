import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/ml/client";

export const dynamic = "force-dynamic";

function appUrl(path: string): string {
  const mlRedirect = process.env.ML_REDIRECT_URI || "";
  if (mlRedirect) {
    const base = mlRedirect.replace(/\/api\/ml\/auth\/callback$/, "");
    return `${base}${path}`;
  }
  return path;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    console.error("ML OAuth error:", error);
    return NextResponse.redirect(appUrl("/configuracion/mercadolibre?error=auth_denied"));
  }

  if (!code) {
    return NextResponse.redirect(appUrl("/configuracion/mercadolibre?error=no_code"));
  }

  try {
    const redirectUri = process.env.ML_REDIRECT_URI || `${request.nextUrl.origin}/api/ml/auth/callback`;
    await exchangeCodeForToken(code, redirectUri);

    return NextResponse.redirect(appUrl("/configuracion/mercadolibre?ml=connected"));
  } catch (e) {
    console.error("ML token exchange error:", e);
    return NextResponse.redirect(appUrl("/configuracion/mercadolibre?error=token_exchange"));
  }
}
