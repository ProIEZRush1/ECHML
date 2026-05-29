import { prisma } from "@/lib/prisma";
import { mlFetch } from "@/lib/ml/client";

export interface AdsItem {
  item_id: string;
  title: string;
  campaign_id: number;
  ad_group_id?: number;
  status: string;
  domain_id?: string;
  user_product_id?: string;
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
}

export interface AdsSummary {
  cost: number;
  clicks: number;
  prints: number;
  total_amount: number;
  units_quantity: number;
}

interface AdsSearchResponse {
  paging: { total: number; offset: number; limit: number };
  results: AdsItem[];
  metrics_summary?: AdsSummary;
}

export interface AdsSnapshot {
  items: AdsItem[];
  summary: AdsSummary | null; // ML's authoritative account-wide total for the query
  syncedAt: string;
  dateFrom?: string;
  dateTo?: string;
}

const ADVERTISER_ID = 853025;
const PAGE_LIMIT = 500; // ML max; fewer pages = less drift while paginating a live dataset

export interface AdsFetchResult {
  items: AdsItem[];
  summary: AdsSummary | null;
}

/**
 * Fetch every ad for the advertiser in the date range, straight from ML.
 * - Pages of 500 (ML's max) so a 1000+ ad account is 2-3 requests, not 20+.
 * - De-dupes by ad identity (item_id + campaign + ad_group) so a row that shifts
 *   across page boundaries while ML's live dataset changes is never double-counted.
 * - Also returns ML's own `metrics_summary` (authoritative account total) for cross-check.
 * Every `metrics.cost` is ML's real per-listing spend — we never invent or estimate.
 */
export async function fetchAdsFromML(dateFrom: string, dateTo: string): Promise<AdsFetchResult> {
  const seen = new Set<string>();
  const items: AdsItem[] = [];
  let summary: AdsSummary | null = null;
  let offset = 0;
  let total = Infinity;
  const metrics = "cost,clicks,prints,total_amount,acos,roas,direct_amount,indirect_amount,units_quantity";

  while (offset < total) {
    const data = await mlFetch<AdsSearchResponse>(
      `/advertising/MLM/advertisers/${ADVERTISER_ID}/product_ads/ads/search?limit=${PAGE_LIMIT}&offset=${offset}&date_from=${dateFrom}&date_to=${dateTo}&filters[statuses]=active,paused,hold,idle&metrics=${metrics}&metrics_summary=true`,
      { headers: { "api-version": "2" } }
    );
    total = data.paging.total;
    if (!summary && data.metrics_summary) summary = data.metrics_summary;
    for (const r of data.results) {
      const key = `${r.item_id}|${r.campaign_id}|${r.ad_group_id ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(r);
    }
    if (data.results.length === 0) break;
    offset += PAGE_LIMIT;
  }
  return { items, summary };
}

export async function getAdsSnapshot(): Promise<AdsSnapshot | null> {
  const config = await prisma.systemConfig.findUnique({ where: { key: "ads_snapshot" } });
  if (!config) return null;
  try {
    return JSON.parse(config.value);
  } catch {
    return null;
  }
}

export async function saveAdsSnapshot(
  items: AdsItem[],
  summary: AdsSummary | null,
  dateFrom: string,
  dateTo: string
): Promise<void> {
  const value = JSON.stringify({ items, summary, syncedAt: new Date().toISOString(), dateFrom, dateTo });
  await prisma.systemConfig.upsert({
    where: { key: "ads_snapshot" },
    update: { value },
    create: { key: "ads_snapshot", value },
  });
}

/**
 * Refresh the ads snapshot from ML only when it's stale or the requested date
 * range changed. Keeps page reloads showing live ML data without re-fetching on
 * every single load. Never throws — ads issues must not block the page.
 */
export async function refreshAdsSnapshotIfStale(
  dateFrom: string,
  dateTo: string,
  maxAgeMs = 5 * 60 * 1000
): Promise<void> {
  try {
    const snapshot = await getAdsSnapshot();
    const rangeChanged = !snapshot || snapshot.dateFrom !== dateFrom || snapshot.dateTo !== dateTo;
    const stale = !snapshot || Date.now() - new Date(snapshot.syncedAt).getTime() > maxAgeMs;
    if (rangeChanged || stale) {
      const { items, summary } = await fetchAdsFromML(dateFrom, dateTo);
      await saveAdsSnapshot(items, summary, dateFrom, dateTo);
    }
  } catch {
    /* ignore — keep showing last snapshot */
  }
}
