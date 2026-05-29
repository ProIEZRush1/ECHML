import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAnyAuth } from "@/lib/api-auth";
import { mlFetch } from "@/lib/ml/client";

export const maxDuration = 300;

const PLAYERA_PRODUCT_ID = "prod-playera-bm";
const PLAYERA_GROUP_ID = "pg-camisas";
const COLOR_KEY: Record<string, string> = { Negro: "negro", Blanco: "blanco", Gris: "gris" };

interface MLItem {
  id: string;
  title: string;
  price: number;
  available_quantity: number;
  permalink: string;
  thumbnail: string | null;
  status: string;
  domain_id: string;
  attributes: Array<{ id: string; value_name: string | null }>;
}

function attr(item: MLItem, id: string): string | null {
  return item.attributes?.find((a) => a.id === id)?.value_name ?? null;
}

// Build the variant->quantity list for a playera clone based on color/size/units.
function buildItems(color: string, size: string, units: number): { variantId: string; qty: number }[] | { error: string } {
  const s = size.toLowerCase();
  if (color === "Multicolor") {
    const per = Math.max(1, Math.round(units / 3));
    return ["negro", "blanco", "gris"].map((c) => ({ variantId: `pv-play-${c}-${s}`, qty: per }));
  }
  const ck = COLOR_KEY[color];
  if (!ck) return { error: `unknown color ${color}` };
  return [{ variantId: `pv-play-${ck}-${s}`, qty: units }];
}

export async function POST(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { itemIds?: string[] };
  const log: string[] = [];

  // Ensure the playera product is in the Playeras group (idempotent)
  await prisma.productGroupItem.upsert({
    where: { productGroupId_productId: { productGroupId: PLAYERA_GROUP_ID, productId: PLAYERA_PRODUCT_ID } },
    create: { productGroupId: PLAYERA_GROUP_ID, productId: PLAYERA_PRODUCT_ID },
    update: {},
  }).catch(() => {});

  // Determine target item IDs: explicit list, or auto-detect unlinked active T_SHIRTS
  let itemIds = body.itemIds || [];
  if (itemIds.length === 0) {
    const me = await mlFetch<{ id: number }>("/users/me");
    const all: string[] = [];
    let offset = 0;
    while (true) {
      const page = await mlFetch<{ results: string[]; paging: { total: number } }>(
        `/users/${me.id}/items/search?status=active&limit=100&offset=${offset}`
      );
      all.push(...page.results);
      if (offset + 100 >= page.paging.total) break;
      offset += 100;
    }
    const existing = new Set((await prisma.mLListing.findMany({ select: { mlItemId: true } })).map((l) => l.mlItemId));
    for (let i = 0; i < all.length; i += 20) {
      const batch = all.slice(i, i + 20).filter((id) => !existing.has(id));
      if (batch.length === 0) continue;
      const items = await mlFetch<{ code: number; body: { id: string; domain_id: string } }[]>(
        `/items?ids=${batch.join(",")}&attributes=id,domain_id`
      );
      for (const it of items) if (it.code === 200 && it.body.domain_id === "MLM-T_SHIRTS") itemIds.push(it.body.id);
    }
  }
  log.push(`Targets: ${itemIds.length}`);

  let linked = 0, skipped = 0, errors = 0;

  for (const id of itemIds) {
    try {
      const item = await mlFetch<MLItem>(`/items/${id}`);
      const color = attr(item, "COLOR") || "";
      const size = attr(item, "SIZE") || "";
      const units = parseInt(attr(item, "UNITS_PER_PACK") || "3", 10) || 3;
      if (!color || !size) { log.push(`ERR ${id}: missing color/size`); errors++; continue; }

      const built = buildItems(color, size, units);
      if ("error" in built) { log.push(`ERR ${id}: ${built.error}`); errors++; continue; }

      // Verify all variants exist
      const variantIds = built.map((b) => b.variantId);
      const found = await prisma.productVariant.findMany({ where: { id: { in: variantIds } }, select: { id: true } });
      const foundSet = new Set(found.map((v) => v.id));
      const missing = variantIds.filter((v) => !foundSet.has(v));
      if (missing.length) { log.push(`ERR ${id}: missing variants ${missing.join(",")}`); errors++; continue; }

      // Resolve pack: reuse existing listing's pack, or create pack + listing
      const existing = await prisma.mLListing.findUnique({ where: { mlItemId: id } });
      let packId: string;
      let wasNew = false;
      if (existing) {
        packId = existing.packId;
      } else {
        const sku = `ML-${id.replace("MLM", "")}`;
        const pack = await prisma.pack.upsert({
          where: { sku },
          create: {
            sku,
            name: item.title.length > 80 ? item.title.slice(0, 77) + "..." : item.title,
            salePrice: item.price || 0,
            stock: item.available_quantity || 0,
            imageUrl: item.thumbnail || null,
            description: `No-oversize clone: ${id}`,
          },
          update: {},
        });
        packId = pack.id;
        await prisma.mLListing.create({
          data: {
            mlItemId: id,
            packId,
            title: item.title,
            permalink: item.permalink,
            status: "ACTIVE",
            currentStock: item.available_quantity,
            currentPrice: item.price,
            lastSyncedAt: new Date(),
          },
        });
        wasNew = true;
      }

      // Ensure PackItems exist (idempotent — fixes packs created without items)
      let itemsAdded = 0;
      for (const b of built) {
        const existingItem = await prisma.packItem.findUnique({
          where: { packId_productVariantId: { packId, productVariantId: b.variantId } },
        });
        if (!existingItem) {
          await prisma.packItem.create({ data: { packId, productVariantId: b.variantId, quantity: b.qty } });
          itemsAdded++;
        }
      }

      if (wasNew) linked++; else skipped++;
      log.push(`${wasNew ? "OK" : "FIX"} ${id}: ${color}/${size} x${units} | +${itemsAdded} items -> ${built.map((b) => `${b.variantId}:${b.qty}`).join(", ")}`);
    } catch (e) {
      errors++;
      log.push(`ERR ${id}: ${String(e).slice(0, 150)}`);
    }
  }

  log.push(`Done: ${linked} linked, ${skipped} already linked, ${errors} errors`);
  return NextResponse.json({ success: true, linked, skipped, errors, log });
}
