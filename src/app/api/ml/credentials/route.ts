/**
 * API routes for managing MercadoLibre credentials.
 *
 * POST: Save new app ID + client secret (creates placeholder MLCredential)
 * GET: Return current credential status
 * DELETE: Remove credentials (disconnect)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";

export async function POST(request: Request): Promise<NextResponse> {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { appId, clientSecret } = body as {
      appId?: string;
      clientSecret?: string;
    };

    if (!appId || !clientSecret) {
      return NextResponse.json(
        { error: "App ID y Client Secret son requeridos" },
        { status: 400 }
      );
    }

    // Check if credentials already exist
    const existing = await prisma.mLCredential.findFirst();
    if (existing) {
      // Update existing
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
      // Create new with placeholder tokens
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

    return NextResponse.json({ success: true });
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
      return NextResponse.json({
        connected: false,
        appId: null,
        mlUserId: null,
        tokenExpiry: null,
      });
    }

    // Mask the app ID (show last 4 chars)
    const maskedAppId =
      credential.appId.length > 4
        ? "****" + credential.appId.slice(-4)
        : credential.appId;

    const hasValidToken =
      credential.accessToken !== "" &&
      credential.tokenExpiresAt > new Date();

    return NextResponse.json({
      connected: true,
      appId: maskedAppId,
      mlUserId: credential.mlUserId.toString(),
      tokenExpiry: credential.tokenExpiresAt.toISOString(),
      hasValidToken,
      scope: credential.scope,
      updatedAt: credential.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Error fetching ML credential status:", error);
    return NextResponse.json(
      { error: "Error al obtener el estado de las credenciales" },
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
    const credential = await prisma.mLCredential.findFirst();

    if (!credential) {
      return NextResponse.json(
        { error: "No hay credenciales para eliminar" },
        { status: 404 }
      );
    }

    await prisma.mLCredential.delete({
      where: { id: credential.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting ML credentials:", error);
    return NextResponse.json(
      { error: "Error al eliminar las credenciales" },
      { status: 500 }
    );
  }
}
