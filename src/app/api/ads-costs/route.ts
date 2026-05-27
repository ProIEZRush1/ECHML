export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { verifyAnyAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { mlFetch } from "@/lib/ml/client";

const adsCache = new Map<string, { data: AdsSearchResponse["results"]; ts: number }>();
const CACHE_TTL = 300_000; // 5 minutes — ML ads data updates in real-time, longer cache prevents reload inconsistencies

interface AdsSearchResponse {
  paging: { total: number; offset: number; limit: number };
  results: Array<{
    item_id: string;
    title: string;
    campaign_id: number;
    status: string;
    metrics: {
      cost: number;
      clicks: number;
      prints: number;
      total_amount: number;
      acos: number;
      roas: number;
      direct_amount: number;
      indirect_amount: number;
      units_quantity: number;
    };
  }>;
  metrics_summary?: {
    cost: number;
    clicks: number;
    prints: number;
    total_amount: number;
    acos: number;
  };
}

export async function GET(request: NextRequest) {
  const user = await verifyAnyAuth(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const dateFrom = request.nextUrl.searchParams.get("dateFrom") || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const dateTo = request.nextUrl.searchParams.get("dateTo") || new Date().toISOString().split("T")[0];
  const productIdsParam = request.nextUrl.searchParams.get("productIds");
  const packIdsParam = request.nextUrl.searchParams.get("packIds");

  try {
    const advertiserId = 853025;
    const cacheKey = `${dateFrom}:${dateTo}`;
    const cached = adsCache.get(cacheKey);
    let allItems: AdsSearchResponse["results"];

    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      allItems = cached.data;
    } else {
      allItems = [];
      let offset = 0;
      const limit = 50;
      let total = Infinity;

      while (offset < total) {
        const data = await mlFetch<AdsSearchResponse>(
          `/advertising/MLM/advertisers/${advertiserId}/product_ads/ads/search?limit=${limit}&offset=${offset}&date_from=${dateFrom}&date_to=${dateTo}&filters[statuses]=active,paused,hold,idle&metrics=cost,clicks,prints,total_amount,acos,roas,direct_amount,indirect_amount,units_quantity&metrics_summary=true`,
          { headers: { "api-version": "2" } }
        );
        total = data.paging.total;
        allItems.push(...data.results);
        offset += limit;
        if (offset >= total) break;
      }
      adsCache.set(cacheKey, { data: allItems, ts: Date.now() });
    }

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

    // Build allowed ML item IDs filter based on productIds/packIds params
    let allowedItemIds: Set<string> | null = null;
    if (productIdsParam || packIdsParam) {
      allowedItemIds = new Set<string>();
      const filterProductIds = productIdsParam ? productIdsParam.split(",").filter(Boolean) : [];
      const filterPackIds = packIdsParam ? packIdsParam.split(",").filter(Boolean) : [];

      // Find packs linked to these products via PackItem → ProductVariant
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

    // Filter allItems by allowed IDs if filter is active
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
      const itemCost = item.metrics.cost || 0;
      const itemClicks = item.metrics.clicks || 0;
      const itemPrints = item.metrics.prints || 0;
      const itemSales = item.metrics.total_amount || 0;
      const itemUnits = item.metrics.units_quantity || 0;

      p.cost += itemCost;
      p.clicks += itemClicks;
      p.prints += itemPrints;
      p.salesAmount += itemSales;
      p.units += itemUnits;

      p.items.push({
        id: item.item_id,
        title: item.title,
        cost: Math.round(itemCost * 100) / 100,
        clicks: itemClicks,
        prints: itemPrints,
        salesAmount: Math.round(itemSales * 100) / 100,
        units: itemUnits,
      });
    }

    const totalCost = filteredItems.reduce((s, i) => s + (i.metrics.cost || 0), 0);
    const totalClicks = filteredItems.reduce((s, i) => s + (i.metrics.clicks || 0), 0);
    const totalSales = filteredItems.reduce((s, i) => s + (i.metrics.total_amount || 0), 0);

    return NextResponse.json({
      dateFrom,
      dateTo,
      totalAdsCost: Math.round(totalCost * 100) / 100,
      totalClicks,
      totalSalesFromAds: Math.round(totalSales * 100) / 100,
      overallAcos: totalSales > 0 ? Math.round((totalCost / totalSales) * 10000) / 100 : 0,
      itemCount: filteredItems.length,
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
