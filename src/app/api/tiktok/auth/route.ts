import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { getTikTokCredentials, buildTikTokAuthURL } from "@/lib/tiktok/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const cred = await getTikTokCredentials();
  if (!cred) {
    return NextResponse.json(
      { error: "No hay credenciales de TikTok configuradas" },
      { status: 400 }
    );
  }

  const authUrl = buildTikTokAuthURL(cred.appKey);
  return NextResponse.redirect(authUrl);
}
