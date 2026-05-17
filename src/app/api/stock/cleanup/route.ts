export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { verifyAnyAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { recalculateAffectedPacks } from "@/lib/stock/engine";

export async function POST(request: NextRequest) {
  const user = await verifyAnyAuth(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const results: string[] = [];

  // 1. Delete junk variants on prod-playera-bm (those without pv-play- prefix)
  const playera = await prisma.product.findUnique({
    where: { id: "prod-playera-bm" },
    include: { variants: true },
  });

  if (playera) {
    const junkVariants = playera.variants.filter((v) => !v.id.startsWith("pv-play-"));
    for (const junk of junkVariants) {
      await prisma.packItem.deleteMany({ where: { productVariantId: junk.id } });
      await prisma.stockLog.deleteMany({ where: { productVariantId: junk.id } });
      await prisma.stockEntryItem.deleteMany({ where: { productVariantId: junk.id } });
      await prisma.productVariant.delete({ where: { id: junk.id } });
      results.push(`Deleted junk variant: ${junk.variantLabel} (${junk.id}, stock=${junk.stock})`);
    }
  }

  // 2. Fix Negro S packs — add pv-play-negro-s with correct quantity
  const negroSPacks = await prisma.pack.findMany({
    where: {
      name: { contains: "Negro S", mode: "insensitive" },
      items: { none: { productVariantId: "pv-play-negro-s" } },
    },
    include: { items: true },
  });

  for (const pack of negroSPacks) {
    let qty = 3;
    const nameLower = pack.name.toLowerCase();
    if (nameLower.includes("pack 6") || nameLower.includes("6 playera")) qty = 6;
    else if (nameLower.includes("pack 4") || nameLower.includes("4 playera")) qty = 4;

    await prisma.packItem.create({
      data: {
        packId: pack.id,
        productVariantId: "pv-play-negro-s",
        quantity: qty,
      },
    });
    results.push(`Added pv-play-negro-s (qty=${qty}) to: ${pack.name}`);
  }

  // 3. Recalculate all pack stocks
  const allVariants = await prisma.productVariant.findMany({
    where: { id: { startsWith: "pv-play-" } },
    select: { id: true },
  });
  await recalculateAffectedPacks(allVariants.map((v) => v.id));
  results.push("Recalculated all playera pack stocks");

  return NextResponse.json({ results });
}
