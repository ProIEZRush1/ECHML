import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAnyAuth } from "@/lib/api-auth";

export const maxDuration = 180;

const OVERSIZE_ID = "prod-playera-bm";
const NORMAL_ID = "prod-playera-normal";
const GROUP_ID = "pg-camisas";
const CLONE_MARKER = "No-oversize clone:";

// Splits the shared playera product into two:
//  - rename prod-playera-bm -> "Playera Oversized" (keeps all oversize packs)
//  - create "Playera Normal" with the 12 variants, stock copied from oversize
//  - re-point all no-oversize clone packs' PackItems to the Normal variants
export async function POST(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "true";

  const ov = await prisma.product.findUnique({ where: { id: OVERSIZE_ID }, include: { variants: true } });
  if (!ov) return NextResponse.json({ error: "prod-playera-bm not found" }, { status: 404 });

  const clonePacks = await prisma.pack.findMany({
    where: { description: { startsWith: CLONE_MARKER } },
    include: { items: true },
  });
  const ovVariantIds = new Set(ov.variants.map((v) => v.id));
  let itemsToMove = 0;
  for (const p of clonePacks) for (const it of p.items) if (ovVariantIds.has(it.productVariantId)) itemsToMove++;

  const plan = {
    rename: `${ov.name} -> Playera Oversized`,
    normalVariantsToCreate: ov.variants.length,
    stockCopy: ov.variants.map((v) => ({ label: v.variantLabel, stock: v.stock })),
    clonePacks: clonePacks.length,
    packItemsToMove: itemsToMove,
  };
  if (dryRun) return NextResponse.json({ dryRun: true, plan });

  // 1. rename oversize product
  await prisma.product.update({ where: { id: OVERSIZE_ID }, data: { name: "Playera Oversized" } });

  // 2. create Normal product
  await prisma.product.upsert({
    where: { id: NORMAL_ID },
    create: { id: NORMAL_ID, name: "Playera Normal", supplierCode: "BM-PLAYERA-NORMAL", unitCost: ov.unitCost, supplierId: ov.supplierId, brand: ov.brand },
    update: { name: "Playera Normal" },
  });

  // 3. create Normal variants (stock copied from oversize)
  const ovToNorm = new Map<string, string>();
  for (const v of ov.variants) {
    const nid = v.id.replace("pv-play-", "pv-norm-");
    await prisma.productVariant.upsert({
      where: { id: nid },
      create: { id: nid, productId: NORMAL_ID, color: v.color, variantLabel: v.variantLabel, stock: v.stock },
      update: { stock: v.stock },
    });
    ovToNorm.set(v.id, nid);
  }

  // 4. add Normal product to Playeras group
  await prisma.productGroupItem.upsert({
    where: { productGroupId_productId: { productGroupId: GROUP_ID, productId: NORMAL_ID } },
    create: { productGroupId: GROUP_ID, productId: NORMAL_ID },
    update: {},
  });

  // 5. re-point clone packs' PackItems to Normal variants
  let moved = 0, skipped = 0;
  for (const p of clonePacks) {
    for (const it of p.items) {
      const nid = ovToNorm.get(it.productVariantId);
      if (!nid) { skipped++; continue; }
      // avoid unique [packId, productVariantId] collision
      const exists = await prisma.packItem.findUnique({ where: { packId_productVariantId: { packId: p.id, productVariantId: nid } } });
      if (exists) { await prisma.packItem.delete({ where: { id: it.id } }); }
      else { await prisma.packItem.update({ where: { id: it.id }, data: { productVariantId: nid } }); }
      moved++;
    }
  }

  return NextResponse.json({ success: true, renamed: "Playera Oversized", normalProduct: NORMAL_ID, normalVariants: ov.variants.length, clonePacks: clonePacks.length, packItemsMoved: moved, skipped });
}
