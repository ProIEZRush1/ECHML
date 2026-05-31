export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAnyAuth } from "@/lib/api-auth";
import { mlFetch, getMLCredentials } from "@/lib/ml/client";

/**
 * Read-only order-by-order reconciliation: ML (authoritative, via /orders/search)
 * vs the local MLOrder table — for a date range. Reports exactly which ML orders
 * are missing locally, which differ in amount, and which local orders ML's range
 * doesn't return. Use to confirm "every sale matched" and to drive a backfill.
 */
interface MLOrderSearchResult {
  id: number;
  status?: string;
  date_created?: string;
  total_amount?: number;
  order_items?: Array<{ item?: { id?: string }; quantity?: number; unit_price?: number }>;
}

export async function GET(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.get("from") || "") ? sp.get("from")! : null;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(sp.get("to") || "") ? sp.get("to")! : null;
  if (!from || !to) return NextResponse.json({ error: "from/to requeridos (YYYY-MM-DD)" }, { status: 400 });

  const creds = await getMLCredentials();
  if (!creds) return NextResponse.json({ error: "Sin credenciales ML" }, { status: 400 });
  const seller = creds.mlUserId.toString();

  // 1) Pull ML paid orders for the range (authoritative).
  const fromISO = `${from}T00:00:00.000-06:00`;
  const toISO = `${to}T23:59:59.999-06:00`;
  const ml = new Map<string, { total: number; date: string; status: string }>();
  let offset = 0;
  for (let page = 0; page < 30; page++) {
    const res = await mlFetch<{ results: MLOrderSearchResult[]; paging: { total: number } }>(
      `/orders/search?seller=${seller}&order.status=paid&order.date_created.from=${encodeURIComponent(fromISO)}&order.date_created.to=${encodeURIComponent(toISO)}&sort=date_asc&offset=${offset}&limit=50`
    ).catch(() => null);
    if (!res?.results?.length) break;
    for (const o of res.results) {
      if (!o.id) continue;
      const total = o.total_amount ?? ((o.order_items?.[0]?.unit_price || 0) * (o.order_items?.[0]?.quantity || 1));
      ml.set(String(o.id), { total: Math.round(total * 100) / 100, date: o.date_created || "", status: o.status || "paid" });
    }
    offset += 50;
    if (offset >= (res.paging?.total || 0)) break;
  }

  // 2) Local orders: by the exact ML ids (catches presence regardless of date boundary)
  //    + local orders whose dateCreated falls in the range (catches extras).
  const mlIds = [...ml.keys()].map((s) => BigInt(s));
  const gte = new Date(`${from}T00:00:00.000Z`);
  const lte = new Date(`${to}T23:59:59.999Z`);
  const [localByIds, localInRange] = await Promise.all([
    prisma.mLOrder.findMany({ where: { mlOrderId: { in: mlIds } }, select: { mlOrderId: true, totalAmount: true } }),
    prisma.mLOrder.findMany({ where: { dateCreated: { gte, lte } }, select: { mlOrderId: true, totalAmount: true } }),
  ]);
  const localMap = new Map(localByIds.map((o) => [o.mlOrderId.toString(), Number(o.totalAmount)]));
  const localRangeIds = new Set(localInRange.map((o) => o.mlOrderId.toString()));

  // 3) Diff.
  const missingInCrm: Array<{ id: string; total: number; date: string }> = [];
  const amountMismatch: Array<{ id: string; ml: number; crm: number }> = [];
  let mlGross = 0;
  for (const [id, m] of ml) {
    mlGross += m.total;
    if (!localMap.has(id)) {
      missingInCrm.push({ id, total: m.total, date: m.date });
    } else {
      const crm = localMap.get(id)!;
      if (Math.abs(crm - m.total) > 0.5) amountMismatch.push({ id, ml: m.total, crm });
    }
  }
  const mlIdSet = new Set(ml.keys());
  const extraInCrm = [...localRangeIds].filter((id) => !mlIdSet.has(id));

  return NextResponse.json({
    range: { from, to },
    ml: { count: ml.size, gross: Math.round(mlGross * 100) / 100 },
    crm: { matchedById: localMap.size, inDateRange: localInRange.length },
    missingInCrmCount: missingInCrm.length,
    amountMismatchCount: amountMismatch.length,
    extraInCrmCount: extraInCrm.length,
    missingInCrm: missingInCrm.slice(0, 80),
    amountMismatch: amountMismatch.slice(0, 80),
    extraInCrm: extraInCrm.slice(0, 80),
  });
}
