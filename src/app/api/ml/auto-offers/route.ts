import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAnyAuth } from "@/lib/api-auth";
import { mlFetch } from "@/lib/ml/client";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface PromoItem {
  type: string;
  status: string;
  price: number;
  original_price: number;
  start_date?: string;
  finish_date?: string;
  name?: string;
  min_discounted_price?: number;
  max_discounted_price?: number;
  suggested_discounted_price?: number;
}

interface OfferResult {
  mlItemId: string;
  title: string;
  action: string;
  offerPrice?: number;
  basePrice?: number;
  error?: string;
}

const PLAYERA_DOMAINS = ["MLM-T_SHIRTS"];
const TIMIS_CATEGORIES = ["MLM5363", "MLM5367", "MLM5365"];
// Cubrebocas / tapabocas — surgical+industrial and reusable mask domains
const MASK_DOMAINS = ["MLM-SURGICAL_AND_INDUSTRIAL_MASKS", "MLM-REUSABLE_MASKS"];
// Masks run on thin margins; default to the smallest credible discount (≈5% off,
// near ML's max_discounted_price) so the offer badge doesn't erase the margin.
const MASK_DEFAULT_FACTOR = 0.95;

function getNextMonthRange(): { start: string; end: string } {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  const start = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01T00:00:00`;
  const end = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}T23:59:59`;
  return { start, end };
}

function getCurrentMonthRange(): { start: string; end: string } {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const start = `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, "0")}-01T00:00:00`;
  const end = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}T23:59:59`;
  return { start, end };
}

async function getItemPromos(mlItemId: string): Promise<PromoItem[]> {
  try {
    return await mlFetch<PromoItem[]>(
      `/seller-promotions/items/${mlItemId}`,
      { params: { app_version: "v2" } }
    );
  } catch {
    return [];
  }
}

async function createOffer(
  mlItemId: string,
  dealPrice: number,
  startDate: string,
  finishDate: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await mlFetch(`/seller-promotions/items/${mlItemId}`, {
      method: "POST",
      params: { app_version: "v2" },
      body: JSON.stringify({
        deal_price: dealPrice,
        start_date: startDate,
        finish_date: finishDate,
      }),
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function getItemBasicInfo(
  mlItemId: string
): Promise<{ price: number; domain_id: string; category_id: string; listing_type_id: string } | null> {
  try {
    return await mlFetch<{ price: number; domain_id: string; category_id: string; listing_type_id: string }>(
      `/items/${mlItemId}`,
      { params: { attributes: "price,domain_id,category_id,listing_type_id" } }
    );
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const user = await verifyAnyAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const listings = await prisma.mLListing.findMany({
    where: { status: "ACTIVE" },
    select: { mlItemId: true, title: true, currentPrice: true },
    orderBy: { title: "asc" },
  });

  const results: Array<{
    mlItemId: string;
    title: string;
    currentPrice: number;
    hasActiveOffer: boolean;
    hasScheduledOffer: boolean;
    offerPrice: number | null;
    offerEnd: string | null;
    domain: string | null;
    isPlayera: boolean;
    isTimis: boolean;
    isMask: boolean;
  }> = [];

  const batchSize = 5;
  for (let i = 0; i < listings.length; i += batchSize) {
    const batch = listings.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (listing) => {
        const [promos, info] = await Promise.all([
          getItemPromos(listing.mlItemId),
          getItemBasicInfo(listing.mlItemId),
        ]);

        const activeDiscount = promos.find(
          (p) => p.type === "PRICE_DISCOUNT" && p.status === "started"
        );
        const scheduledDiscount = promos.find(
          (p) => p.type === "PRICE_DISCOUNT" && p.status === "scheduled"
        );
        const anyDiscount = activeDiscount || scheduledDiscount;

        const isPlayera = info ? PLAYERA_DOMAINS.includes(info.domain_id) : false;
        const isTimis = info ? TIMIS_CATEGORIES.includes(info.category_id) : false;
        const isMask = info ? MASK_DOMAINS.includes(info.domain_id) : false;

        return {
          mlItemId: listing.mlItemId,
          title: listing.title || "",
          currentPrice: Number(listing.currentPrice || 0),
          hasActiveOffer: !!activeDiscount,
          hasScheduledOffer: !!scheduledDiscount,
          offerPrice: anyDiscount?.price || null,
          offerEnd: anyDiscount?.finish_date || null,
          domain: info?.domain_id || null,
          isPlayera,
          isTimis,
          isMask,
        };
      })
    );
    results.push(...batchResults);
  }

  const playeras = results.filter((r) => r.isPlayera);
  const timis = results.filter((r) => r.isTimis);
  const masks = results.filter((r) => r.isMask);

  return NextResponse.json({
    total: results.length,
    playeras: { count: playeras.length, items: playeras },
    timis: { count: timis.length, items: timis },
    masks: { count: masks.length, items: masks },
    nextMonth: getNextMonthRange(),
  });
}

export async function POST(request: NextRequest) {
  const user = await verifyAnyAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const dryRun = body.dryRun === true;
  const forceCurrentMonth = body.forceCurrentMonth === true;
  // Optional scope: "masks" | "playeras" | "timis" — limit the run to one segment.
  const only: string | null = typeof body.only === "string" ? body.only : null;

  const dateRange = forceCurrentMonth ? getCurrentMonthRange() : getNextMonthRange();

  const listings = await prisma.mLListing.findMany({
    where: { status: "ACTIVE" },
    select: { mlItemId: true, title: true, currentPrice: true },
  });

  const results: OfferResult[] = [];
  let created = 0;
  let skipped = 0;
  let errors = 0;

  const batchSize = 3;
  for (let i = 0; i < listings.length; i += batchSize) {
    const batch = listings.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (listing): Promise<OfferResult> => {
        const info = await getItemBasicInfo(listing.mlItemId);
        if (!info) {
          return { mlItemId: listing.mlItemId, title: listing.title || "", action: "skip_no_info" };
        }

        const isPlayera = PLAYERA_DOMAINS.includes(info.domain_id);
        const isTimis = TIMIS_CATEGORIES.includes(info.category_id);
        const isMask = MASK_DOMAINS.includes(info.domain_id);

        if (!isPlayera && !isTimis && !isMask) {
          return { mlItemId: listing.mlItemId, title: listing.title || "", action: "skip_not_target" };
        }
        // Scope filter: if `only` is set, skip items outside that segment.
        if (
          (only === "masks" && !isMask) ||
          (only === "playeras" && !isPlayera) ||
          (only === "timis" && !isTimis)
        ) {
          return { mlItemId: listing.mlItemId, title: listing.title || "", action: "skip_not_target" };
        }

        const promos = await getItemPromos(listing.mlItemId);

        const activeDiscount = promos.find(
          (p) => p.type === "PRICE_DISCOUNT" && (p.status === "started" || p.status === "scheduled")
        );
        const candidateDiscount = promos.find(
          (p) => p.type === "PRICE_DISCOUNT" && p.status === "candidate"
        );
        const activeDeal = promos.find(
          (p) => p.type === "DEAL" && (p.status === "started" || p.status === "pending")
        );

        let offerPrice: number;
        if (activeDiscount && activeDiscount.price > 0) {
          offerPrice = activeDiscount.price;
        } else if (body.discountPercent) {
          offerPrice = Math.round(info.price * (1 - body.discountPercent / 100));
        } else {
          offerPrice = Math.round(info.price * (isMask ? MASK_DEFAULT_FACTOR : 0.80));
        }

        if (candidateDiscount) {
          const minPrice = candidateDiscount.min_discounted_price ?? 0;
          const maxPrice = candidateDiscount.max_discounted_price ?? info.price;
          if (offerPrice < minPrice) offerPrice = Math.ceil(minPrice);
          if (offerPrice > maxPrice) offerPrice = Math.floor(maxPrice);
        }

        let effectiveStart = dateRange.start;
        let effectiveEnd = dateRange.end;

        if (activeDeal?.finish_date) {
          const dealEnd = new Date(activeDeal.finish_date);
          const rangeStart = new Date(dateRange.start);
          if (rangeStart < dealEnd) {
            dealEnd.setDate(dealEnd.getDate() + 1);
            effectiveStart = `${dealEnd.getFullYear()}-${String(dealEnd.getMonth() + 1).padStart(2, "0")}-${String(dealEnd.getDate()).padStart(2, "0")}T00:00:00`;
            if (new Date(effectiveStart) >= new Date(effectiveEnd)) {
              return {
                mlItemId: listing.mlItemId,
                title: listing.title || "",
                action: "skip_deal_active",
                offerPrice,
                basePrice: info.price,
                error: `DEAL active until ${activeDeal.finish_date}, can't schedule before ${effectiveEnd}`,
              };
            }
          }
        }

        if (dryRun) {
          return {
            mlItemId: listing.mlItemId,
            title: listing.title || "",
            action: "would_create",
            offerPrice,
            basePrice: info.price,
          };
        }

        const result = await createOffer(listing.mlItemId, offerPrice, effectiveStart, effectiveEnd);
        if (result.success) {
          created++;
          return {
            mlItemId: listing.mlItemId,
            title: listing.title || "",
            action: "created",
            offerPrice,
            basePrice: info.price,
          };
        } else {
          errors++;
          return {
            mlItemId: listing.mlItemId,
            title: listing.title || "",
            action: "error",
            offerPrice,
            basePrice: info.price,
            error: result.error,
          };
        }
      })
    );

    for (const r of batchResults) {
      if (r.action === "skip_not_target" || r.action === "skip_no_info") skipped++;
      results.push(r);
    }
  }

  const config = {
    lastRun: new Date().toISOString(),
    dateRange,
    created,
    skipped,
    errors,
    dryRun,
  };

  await prisma.systemConfig.upsert({
    where: { key: "auto_offers_last_run" },
    update: { value: JSON.stringify(config) },
    create: { key: "auto_offers_last_run", value: JSON.stringify(config) },
  });

  return NextResponse.json({
    message: dryRun ? "Dry run complete" : `Offers processed: ${created} created, ${skipped} skipped, ${errors} errors`,
    dateRange,
    created,
    skipped,
    errors,
    results: results.filter((r) => r.action !== "skip_not_target" && r.action !== "skip_no_info"),
  });
}
