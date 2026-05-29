export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { verifyAnyAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { fetchAdsFromML, getAdsSnapshot, saveAdsSnapshot } from "@/lib/ml/ads";

// GET: Read from DB snapshot (consistent, never changes until sync)
export async function GET(request: NextRequest) {
  const user = await verifyAnyAuth(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const dateFrom = request.nextUrl.searchParams.get("dateFrom") || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const dateTo = request.nextUrl.searchParams.get("dateTo") || new Date().toISOString().split("T")[0];
  const productIdsParam = request.nextUrl.searchParams.get("productIds");
  const packIdsParam = request.nextUrl.searchParams.get("packIds");

  try {
    // Read ONLY from DB snapshot — never fetch from ML on GET
    const snapshot = await getAdsSnapshot();
    if (!snapshot) {
      return NextResponse.json({
        dateFrom, dateTo, syncedAt: null,
        totalAdsCost: 0, totalClicks: 0, totalSalesFromAds: 0, overallAcos: 0, itemCount: 0, byProduct: [],
        message: "No ads data synced yet. Click the sync button to fetch from ML.",
      });
    }

    const allItems = snapshot.items;

    const listings = await prisma.mLListing.findMany({
      select: {
        mlItemId: true,
        packId: true,
        pack: {
          select: {
            id: true,
            sku: true,
            name: true,
            items: {
              select: {
                productVariant: {
                  select: {
                    product: { select: { id: true, name: true, brand: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    const listingMap = new Map(listings.map((l) => [l.mlItemId, l]));

    let allowedItemIds: Set<string> | null = null;
    if (productIdsParam || packIdsParam) {
      allowedItemIds = new Set<string>();
      const filterProductIds = productIdsParam ? productIdsParam.split(",").filter(Boolean) : [];
      const filterPackIds = packIdsParam ? packIdsParam.split(",").filter(Boolean) : [];

      if (filterProductIds.length > 0) {
        const packItems = await prisma.packItem.findMany({
          where: { productVariant: { productId: { in: filterProductIds } } },
          select: { packId: true },
        });
        const linkedPackIds = [...new Set(packItems.map((pi) => pi.packId))];
        const linkedListings = await prisma.mLListing.findMany({
          where: { packId: { in: linkedPackIds } },
          select: { mlItemId: true },
        });
        linkedListings.forEach((l) => allowedItemIds!.add(l.mlItemId));
      }

      if (filterPackIds.length > 0) {
        const packListings = await prisma.mLListing.findMany({
          where: { packId: { in: filterPackIds } },
          select: { mlItemId: true },
        });
        packListings.forEach((l) => allowedItemIds!.add(l.mlItemId));
      }
    }

    const filteredItems = allowedItemIds ? allItems.filter((i) => allowedItemIds!.has(i.item_id)) : allItems;

    interface ItemDetail { id: string; title: string; cost: number; clicks: number; prints: number; salesAmount: number; units: number }
    const productCosts: Record<string, { name: string; brand: string | null; cost: number; clicks: number; prints: number; salesAmount: number; units: number; items: ItemDetail[] }> = {};

    for (const item of filteredItems) {
      const listing = listingMap.get(item.item_id);
      const products = listing?.pack?.items?.map((i) => i.productVariant.product) || [];
      const productName = products[0]?.name || item.title;
      const productId = products[0]?.id || item.item_id;
      const brand = products[0]?.brand || null;

      if (!productCosts[productId]) {
        productCosts[productId] = { name: productName, brand, cost: 0, clicks: 0, prints: 0, salesAmount: 0, units: 0, items: [] };
      }

      const p = productCosts[productId];
      p.cost += item.metrics.cost || 0;
      p.clicks += item.metrics.clicks || 0;
      p.prints += item.metrics.prints || 0;
      p.salesAmount += item.metrics.total_amount || 0;
      p.units += item.metrics.units_quantity || 0;

      p.items.push({
        id: item.item_id,
        title: item.title,
        cost: Math.round((item.metrics.cost || 0) * 100) / 100,
        clicks: item.metrics.clicks || 0,
        prints: item.metrics.prints || 0,
        salesAmount: Math.round((item.metrics.total_amount || 0) * 100) / 100,
        units: item.metrics.units_quantity || 0,
      });
    }

    const totalCost = filteredItems.reduce((s, i) => s + (i.metrics.cost || 0), 0);
    const totalClicks = filteredItems.reduce((s, i) => s + (i.metrics.clicks || 0), 0);
    const totalSales = filteredItems.reduce((s, i) => s + (i.metrics.total_amount || 0), 0);

    return NextResponse.json({
      dateFrom,
      dateTo,
      syncedAt: snapshot.syncedAt,
      totalAdsCost: Math.round(totalCost * 100) / 100,
      totalClicks,
      totalSalesFromAds: Math.round(totalSales * 100) / 100,
      overallAcos: totalSales > 0 ? Math.round((totalCost / totalSales) * 10000) / 100 : 0,
      itemCount: filteredItems.length,
      // ML's own authoritative account-wide total for this date range (cross-check; not filtered).
      mlAccountTotalCost: snapshot.summary ? Math.round(snapshot.summary.cost * 100) / 100 : null,
      byProduct: Object.entries(productCosts)
        .map(([id, data]) => ({
          productId: id,
          ...data,
          cost: Math.round(data.cost * 100) / 100,
          salesAmount: Math.round(data.salesAmount * 100) / 100,
          acos: data.salesAmount > 0 ? Math.round((data.cost / data.salesAmount) * 10000) / 100 : 0,
        }))
        .sort((a, b) => b.cost - a.cost),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST: Sync ads from ML → save to DB
export async function POST(request: NextRequest) {
  const user = await verifyAnyAuth(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const dateFrom = (body as Record<string, string>).dateFrom || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const dateTo = (body as Record<string, string>).dateTo || new Date().toISOString().split("T")[0];

  try {
    const { items, summary } = await fetchAdsFromML(dateFrom, dateTo);
    await saveAdsSnapshot(items, summary, dateFrom, dateTo);
    const totalCost = items.reduce((s, i) => s + (i.metrics.cost || 0), 0);
    return NextResponse.json({
      synced: items.length,
      totalAdsCost: Math.round(totalCost * 100) / 100,
      mlAccountTotalCost: summary ? Math.round(summary.cost * 100) / 100 : null,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
