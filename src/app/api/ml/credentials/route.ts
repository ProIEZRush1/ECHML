import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";
import { buildAuthURL } from "@/lib/ml/client";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { appId, clientSecret } = (await request.json()) as {
      appId?: string;
      clientSecret?: string;
    };

    if (!appId || !clientSecret) {
      return NextResponse.json(
        { error: "App ID y Client Secret son requeridos" },
        { status: 400 }
      );
    }

    const existing = await prisma.mLCredential.findFirst();
    if (existing) {
      await prisma.mLCredential.update({
        where: { id: existing.id },
        data: {
          appId,
          clientSecret,
          accessToken: "",
          refreshToken: "",
          tokenExpiresAt: new Date(0),
          mlUserId: BigInt(0),
        },
      });
    } else {
      await prisma.mLCredential.create({
        data: {
          appId,
          clientSecret,
          accessToken: "",
          refreshToken: "",
          tokenExpiresAt: new Date(0),
          mlUserId: BigInt(0),
        },
      });
    }

    const redirectUri = process.env.ML_REDIRECT_URI || `${request.nextUrl.origin}/api/ml/auth/callback`;
    const authUrl = buildAuthURL(appId, redirectUri);

    return NextResponse.json({ success: true, authUrl });
  } catch (error) {
    console.error("Error saving ML credentials:", error);
    return NextResponse.json(
      { error: "Error al guardar las credenciales" },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse> {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const credential = await prisma.mLCredential.findFirst();
    if (!credential) {
      return NextResponse.json({ connected: false });
    }

    const maskedAppId =
      credential.appId.length > 4
        ? "****" + credential.appId.slice(-4)
        : credential.appId;

    const tokenValid =
      credential.accessToken !== "" &&
      credential.tokenExpiresAt > new Date();

    return NextResponse.json({
      connected: true,
      appId: maskedAppId,
      mlUserId: credential.mlUserId.toString(),
      tokenExpiry: credential.tokenExpiresAt.toISOString(),
      hasValidToken: tokenValid,
      scope: credential.scope,
      updatedAt: credential.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Error fetching ML credential status:", error);
    return NextResponse.json(
      { error: "Error al obtener el estado" },
      { status: 500 }
    );
  }
}

export async function DELETE(): Promise<NextResponse> {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const existing = await prisma.mLCredential.findFirst();
    if (existing) {
      await prisma.mLCredential.update({
        where: { id: existing.id },
        data: {
          accessToken: "",
          refreshToken: "",
          tokenExpiresAt: new Date(0),
          mlUserId: BigInt(0),
          scope: "offline_access read write",
        },
      });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error clearing ML token:", error);
    return NextResponse.json(
      { error: "Error al eliminar el token" },
      { status: 500 }
    );
  }
}
