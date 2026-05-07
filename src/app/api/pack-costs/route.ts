export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { verifyAnyAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await verifyAnyAuth(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const packId = request.nextUrl.searchParams.get("packId");
  const where = packId ? { packId } : {};

  const costs = await prisma.packCost.findMany({
    where,
    include: { pack: { select: { sku: true, name: true } } },
    orderBy: { category: "asc" },
  });

  return NextResponse.json(costs);
}

export async function POST(request: NextRequest) {
  const user = await verifyAnyAuth(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const { packId, category, amount, notes } = body;

  if (!packId || !category || amount === undefined) {
    return NextResponse.json({ error: "packId, category y amount son requeridos" }, { status: 400 });
  }

  const cost = await prisma.packCost.create({
    data: { packId, category, amount, notes },
  });

  return NextResponse.json(cost, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const user = await verifyAnyAuth(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const { id } = body;

  if (!id) return NextResponse.json({ error: "id es requerido" }, { status: 400 });

  await prisma.packCost.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
