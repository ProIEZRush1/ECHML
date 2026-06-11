import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAnyAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

interface LinkInput {
  mlItemId: string;
  packId: string;
  title?: string;
  price?: number;
  stock?: number;
}

// POST /api/ml/link-pack
// Body: { links: [{ mlItemId, packId, title?, price?, stock? }] }
// Upserts MLListing rows so each ML item is linked to the given internal Pack
// (enables stock-sync + sale tracking). Cleans up any orphan auto-pack (ML-<id>)
// that previously held the listing.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { links?: LinkInput[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }
  const links = body.links;
  if (!Array.isArray(links) || links.length === 0) {
    return NextResponse.json({ error: "Falta links[]" }, { status: 400 });
  }

  let linked = 0;
  let backfilled = 0;
  const errors: Array<{ mlItemId: string; error: string }> = [];
  const orphanPackIds = new Set<string>();

  for (const l of links) {
    if (!l.mlItemId || !l.packId) {
      errors.push({ mlItemId: l.mlItemId || "?", error: "mlItemId y packId requeridos" });
      continue;
    }
    try {
      const pack = await prisma.pack.findUnique({ where: { id: l.packId } });
      if (!pack) {
        errors.push({ mlItemId: l.mlItemId, error: `pack ${l.packId} no existe` });
        continue;
      }

      const existing = await prisma.mLListing.findUnique({
        where: { mlItemId: l.mlItemId },
      });
      if (existing && existing.packId !== l.packId) {
        orphanPackIds.add(existing.packId);
      }

      await prisma.mLListing.upsert({
        where: { mlItemId: l.mlItemId },
        update: {
          packId: l.packId,
          title: l.title ?? undefined,
          currentPrice: l.price ?? undefined,
          currentStock: l.stock ?? undefined,
          lastSyncedAt: new Date(),
        },
        create: {
          mlItemId: l.mlItemId,
          packId: l.packId,
          title: l.title ?? null,
          currentPrice: l.price ?? null,
          currentStock: l.stock ?? 0,
          lastSyncedAt: new Date(),
        },
      });
      linked++;

      // Backfill: attribute this listing's PAST sales (synced before it was mapped) to the pack.
      // Only fills transactions with no pack yet — never clobbers a correctly-attributed one.
      const pastOrders = await prisma.mLOrder.findMany({
        where: { mlItemId: l.mlItemId },
        select: { mlOrderId: true },
      });
      if (pastOrders.length > 0) {
        const r = await prisma.mPTransaction.updateMany({
          where: { mlOrderId: { in: pastOrders.map((o) => o.mlOrderId) }, packId: null },
          data: { packId: l.packId },
        });
        backfilled += r.count;
      }
    } catch (e) {
      errors.push({ mlItemId: l.mlItemId, error: e instanceof Error ? e.message : "error" });
    }
  }

  // Delete orphan auto-packs (ML-<id>) that now have no listings
  let orphansDeleted = 0;
  for (const pid of orphanPackIds) {
    const pack = await prisma.pack.findUnique({ where: { id: pid } });
    if (!pack || !pack.sku.startsWith("ML-")) continue;
    const remaining = await prisma.mLListing.count({ where: { packId: pid } });
    if (remaining === 0) {
      await prisma.packItem.deleteMany({ where: { packId: pid } });
      await prisma.pack.delete({ where: { id: pid } });
      orphansDeleted++;
    }
  }

  return NextResponse.json({ linked, backfilled, orphansDeleted, errors, total: links.length });
}
