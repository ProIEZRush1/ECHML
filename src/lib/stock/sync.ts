import { prisma } from "@/lib/prisma";

/**
 * Products whose stock is the SAME physical inventory and must stay in sync.
 * Variants are matched 1:1 by `variantLabel` (e.g. "Negro / L") across the group.
 * "For now": Playera Normal and Playera Oversized are the same garment.
 */
export const STOCK_SYNC_GROUPS: string[][] = [
  ["prod-playera-normal", "prod-playera-bm"],
  // DL360p: 5 listings of the SAME physical HP DL360p Gen8 server (different
  // titles) = single shared inventory. All variants are "Default" (matched 1:1).
  [
    "cmowguxpa00hypb019gb8d2yo",
    "cmp2sxu1l001vqv01e3zzkgyy",
    "cmp2sxu2k0024qv01wx4ascnb",
    "cmp2sxu3c002dqv016hc2xk06",
    "cmp2sxu53002mqv010v86botq",
  ],
];

const productToGroup = new Map<string, string[]>();
for (const group of STOCK_SYNC_GROUPS) {
  for (const productId of group) productToGroup.set(productId, group);
}

/**
 * After a variant's stock changes, mirror the new value to the matching variant
 * (same variantLabel) of every sibling product in its sync group.
 * Returns the ids of variants that were updated so callers can recalc their packs.
 * Best-effort: never throws (stock sync must not break a sale).
 */
export async function syncLinkedVariants(changedVariantIds: string[]): Promise<string[]> {
  if (changedVariantIds.length === 0) return [];
  try {
    const changed = await prisma.productVariant.findMany({
      where: { id: { in: changedVariantIds } },
      select: { id: true, productId: true, variantLabel: true, stock: true },
    });
    const relevant = changed.filter((v) => productToGroup.has(v.productId));
    if (relevant.length === 0) return [];

    const touched: string[] = [];
    for (const v of relevant) {
      const siblingProductIds = productToGroup.get(v.productId)!.filter((pid) => pid !== v.productId);
      if (siblingProductIds.length === 0 || v.variantLabel == null) continue;

      const siblings = await prisma.productVariant.findMany({
        where: { productId: { in: siblingProductIds }, variantLabel: v.variantLabel },
        select: { id: true, stock: true },
      });

      for (const s of siblings) {
        if (s.stock === v.stock) continue;
        await prisma.$transaction([
          prisma.productVariant.update({ where: { id: s.id }, data: { stock: v.stock } }),
          prisma.stockLog.create({
            data: {
              productVariantId: s.id,
              changeType: "ADJUSTMENT",
              quantityChange: v.stock - s.stock,
              previousStock: s.stock,
              newStock: v.stock,
              reason: "Sincronización de stock (Playera Normal ↔ Oversized)",
            },
          }),
        ]);
        touched.push(s.id);
      }
    }
    return touched;
  } catch (err) {
    console.error("syncLinkedVariants failed:", err);
    return [];
  }
}
