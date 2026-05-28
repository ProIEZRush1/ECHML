import { NextRequest, NextResponse } from "next/server";
import { exchangeTikTokCode, fetchAuthorizedShops } from "@/lib/tiktok/client";

export const dynamic = "force-dynamic";

function appUrl(request: NextRequest, path: string): string {
  return `${request.nextUrl.origin}${path}`;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    console.error("TikTok OAuth error:", error);
    return NextResponse.redirect(
      appUrl(request, "/configuracion/tiktok?error=auth_denied")
    );
  }

  if (!code) {
    return NextResponse.redirect(
      appUrl(request, "/configuracion/tiktok?error=no_code")
    );
  }

  try {
    await exchangeTikTokCode(code);
    await fetchAuthorizedShops();

    return NextResponse.redirect(
      appUrl(request, "/configuracion/tiktok?tt=connected")
    );
  } catch (e) {
    console.error("TikTok token exchange error:", e);
    return NextResponse.redirect(
      appUrl(request, "/configuracion/tiktok?error=token_exchange")
    );
  }
}
