import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAnyAuth } from "@/lib/api-auth";
import { buildTikTokAuthURL } from "@/lib/tiktok/client";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { appKey, appSecret } = (await request.json()) as {
      appKey?: string;
      appSecret?: string;
    };

    if (!appKey || !appSecret) {
      return NextResponse.json(
        { error: "App Key y App Secret son requeridos" },
        { status: 400 }
      );
    }

    const existing = await prisma.tikTokCredential.findFirst();
    if (existing) {
      await prisma.tikTokCredential.update({
        where: { id: existing.id },
        data: {
          appKey,
          appSecret,
          accessToken: "",
          refreshToken: "",
          tokenExpiresAt: new Date(0),
          shopId: "",
          shopCipher: "",
          shopName: "",
          openId: "",
          sellerRegion: "",
        },
      });
    } else {
      await prisma.tikTokCredential.create({
        data: { appKey, appSecret },
      });
    }

    const authUrl = buildTikTokAuthURL(appKey);

    return NextResponse.json({ success: true, authUrl });
  } catch (error) {
    console.error("Error saving TikTok credentials:", error);
    return NextResponse.json(
      { error: "Error al guardar las credenciales" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const credential = await prisma.tikTokCredential.findFirst();
    if (!credential) {
      return NextResponse.json({ connected: false });
    }

    const tokenValid =
      credential.accessToken !== "" &&
      credential.tokenExpiresAt > new Date();

    return NextResponse.json({
      connected: true,
      appKey: "****" + credential.appKey.slice(-4),
      shopId: credential.shopId,
      shopName: credential.shopName,
      sellerRegion: credential.sellerRegion,
      hasValidToken: tokenValid,
      tokenExpiry: credential.tokenExpiresAt.toISOString(),
      updatedAt: credential.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Error fetching TikTok credential status:", error);
    return NextResponse.json(
      { error: "Error al obtener el estado" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const existing = await prisma.tikTokCredential.findFirst();
    if (existing) {
      await prisma.tikTokCredential.update({
        where: { id: existing.id },
        data: {
          accessToken: "",
          refreshToken: "",
          tokenExpiresAt: new Date(0),
          shopId: "",
          shopCipher: "",
          shopName: "",
          openId: "",
          sellerRegion: "",
        },
      });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error clearing TikTok token:", error);
    return NextResponse.json(
      { error: "Error al eliminar el token" },
      { status: 500 }
    );
  }
}
