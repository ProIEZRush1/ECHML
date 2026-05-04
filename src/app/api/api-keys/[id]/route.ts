import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  const { id } = await params;

  const apiKey = await prisma.apiKey.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!apiKey) {
    return NextResponse.json(
      { error: "API key no encontrada" },
      { status: 404 }
    );
  }

  if (apiKey.userId !== session.userId) {
    return NextResponse.json(
      { error: "No autorizado" },
      { status: 403 }
    );
  }

  await prisma.apiKey.delete({ where: { id } });

  return NextResponse.json({ message: "API key eliminada" });
}
