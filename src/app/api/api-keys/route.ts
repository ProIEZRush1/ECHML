import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const createApiKeySchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
});

export async function GET() {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  const apiKeys = await prisma.apiKey.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      key: true,
      isActive: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });

  const masked = apiKeys.map((k) => ({
    ...k,
    key: "ech_****" + k.key.slice(-8),
  }));

  return NextResponse.json(masked);
}

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const result = createApiKeySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Datos invalidos", details: result.error.issues },
        { status: 400 }
      );
    }

    const { name } = result.data;
    const key = `ech_${crypto.randomUUID().replace(/-/g, "")}`;

    const apiKey = await prisma.apiKey.create({
      data: {
        name,
        key,
        userId: session.userId,
      },
      select: {
        id: true,
        name: true,
        key: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json(apiKey, { status: 201 });
  } catch (error) {
    console.error("Error al crear API key:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
