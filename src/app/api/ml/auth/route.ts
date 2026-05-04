import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { getMLCredentials, buildAuthURL } from "@/lib/ml/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const cred = await getMLCredentials();
  if (!cred) {
    return NextResponse.redirect(new URL("/setup/mercadolibre", request.url));
  }

  const redirectUri = process.env.ML_REDIRECT_URI || `${request.nextUrl.origin}/api/ml/auth/callback`;
  const authUrl = buildAuthURL(cred.appId, redirectUri);

  return NextResponse.redirect(authUrl);
}
