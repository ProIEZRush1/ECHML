import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mlFetch } from "@/lib/ml/client";

export const maxDuration = 300;

const PLAYERA_DOMAINS = ["MLM-T_SHIRTS"];

interface PromoItem {
  type: string;
  status: string;
  price: number;
  original_price: number;
  start_date?: string;
  finish_date?: string;
  min_discounted_price?: number;
  max_discounted_price?: number;
}

function getPostHotSaleRange(): { start: string; end: string } {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  const start = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}T00:00:00`;
  const end = `${endOfMonth.getFullYear()}-${String(endOfMonth.getMonth() + 1).padStart(2, "0")}-${String(endOfMonth.getDate()).padStart(2, "0")}T23:59:59`;
  return { start, end };
}

export async function POST() {
  const log: string[] = [];
  const dateRange = getPostHotSaleRange();
  log.push(`Date range: ${dateRange.start} → ${dateRange.end}`);

  try {
    // Get all active listings
    const allItems: string[] = [];
    let offset = 0;
    while (true) {
      const page = await mlFetch<{ results: string[]; paging: { total: number } }>(
        `/users/me/items/search?status=active&limit=100&offset=${offset}`
      );
      allItems.push(...page.results);
      if (offset + 100 >= page.paging.total) break;
      offset += 100;
    }
    log.push(`Total active listings: ${allItems.length}`);

    // Get item details in batches to filter playeras
    const playeraItems: { id: string; title: string; price: number }[] = [];
    for (let i = 0; i < allItems.length; i += 20) {
      const batch = allItems.slice(i, i + 20);
      const items = await mlFetch<{ code: number; body: { id: string; title: string; price: number; domain_id: string } }[]>(
        `/items?ids=${batch.join(",")}&attributes=id,title,price,domain_id`
      );
      for (const item of items) {
        if (item.code === 200 && PLAYERA_DOMAINS.includes(item.body.domain_id)) {
          playeraItems.push({ id: item.body.id, title: item.body.title, price: item.body.price });
        }
      }
    }
    log.push(`Playera listings found: ${playeraItems.length}`);

    // For each playera, get current offer and create new one +$10
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < playeraItems.length; i += 3) {
      const batch = playeraItems.slice(i, i + 3);
      await Promise.all(batch.map(async (item) => {
        try {
          const promos = await mlFetch<PromoItem[]>(
            `/seller-promotions/items/${item.id}`,
            { params: { app_version: "v2" } }
          ).catch(() => [] as PromoItem[]);

          const activeOffer = promos.find(
            (p) => p.type === "PRICE_DISCOUNT" && (p.status === "started" || p.status === "scheduled")
          );
          const candidate = promos.find(
            (p) => p.type === "PRICE_DISCOUNT" && p.status === "candidate"
          );

          let currentOfferPrice = activeOffer?.price || item.price;
          let newOfferPrice = Math.round(currentOfferPrice + 10);

          if (candidate) {
            const min = candidate.min_discounted_price ?? 0;
            const max = candidate.max_discounted_price ?? item.price;
            if (newOfferPrice < min) newOfferPrice = Math.ceil(min);
            if (newOfferPrice > max) newOfferPrice = Math.floor(max);
          }

          if (newOfferPrice >= item.price) {
            log.push(`SKIP ${item.id}: new offer $${newOfferPrice} >= base $${item.price}`);
            skipped++;
            return;
          }

          await mlFetch(`/seller-promotions/items/${item.id}`, {
            method: "POST",
            params: { app_version: "v2" },
            body: JSON.stringify({
              deal_price: newOfferPrice,
              start_date: dateRange.start,
              finish_date: dateRange.end,
            }),
          });

          updated++;
          log.push(`OK ${item.id}: ${item.title.substring(0, 50)} | $${currentOfferPrice} → $${newOfferPrice}`);
        } catch (err) {
          errors++;
          log.push(`ERR ${item.id}: ${String(err).substring(0, 100)}`);
        }
      }));
    }

    log.push(`Done: ${updated} updated, ${skipped} skipped, ${errors} errors`);
    return NextResponse.json({ success: true, updated, skipped, errors, log });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error), log }, { status: 500 });
  }
}
