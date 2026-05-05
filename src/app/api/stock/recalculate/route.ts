export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { verifyAnyAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { recalculateAffectedPacks } from "@/lib/stock/engine";

export async function POST(request: NextRequest) {
  const user = await verifyAnyAuth(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const allVariants = await prisma.productVariant.findMany({
    select: { id: true },
  });

  const variantIds = allVariants.map((v) => v.id);
  await recalculateAffectedPacks(variantIds);

  const updatedPacks = await prisma.pack.findMany({
    select: { id: true, sku: true, name: true, stock: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    message: `Recalculados ${updatedPacks.length} packs`,
    packs: updatedPacks,
  });
}
