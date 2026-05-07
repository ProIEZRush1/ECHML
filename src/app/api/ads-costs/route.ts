export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { verifyAnyAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { mlFetch } from "@/lib/ml/client";

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

  try {
    const advertiserId = 853025;
    const allItems: AdsSearchResponse["results"] = [];
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

    const productCosts: Record<string, { name: string; brand: string | null; cost: number; clicks: number; prints: number; salesAmount: number; units: number; items: string[] }> = {};

    for (const item of allItems) {
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
      p.items.push(item.item_id);
    }

    const totalCost = allItems.reduce((s, i) => s + (i.metrics.cost || 0), 0);
    const totalClicks = allItems.reduce((s, i) => s + (i.metrics.clicks || 0), 0);
    const totalSales = allItems.reduce((s, i) => s + (i.metrics.total_amount || 0), 0);

    return NextResponse.json({
      dateFrom,
      dateTo,
      totalAdsCost: Math.round(totalCost * 100) / 100,
      totalClicks,
      totalSalesFromAds: Math.round(totalSales * 100) / 100,
      overallAcos: totalSales > 0 ? Math.round((totalCost / totalSales) * 10000) / 100 : 0,
      itemCount: allItems.length,
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
