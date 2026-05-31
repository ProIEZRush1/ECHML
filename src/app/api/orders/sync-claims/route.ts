export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mlFetch, getMLCredentials } from "@/lib/ml/client";
import type { ShippingStatus } from "@prisma/client";

/**
 * Comprehensive ML claims/returns sync.
 *
 * The old sync only read OPENED claims (role=defendant, no paging) and assumed
 * resource_id was always an order id. That missed the bulk of returns:
 *  - CLOSED claims (cancellations, mediations, returns) — the majority.
 *  - cancel_purchase claims whose resource is a SHIPMENT (resource_id = shipment id, not order).
 *  - whether WE actually lost (buyer refunded) vs won the claim.
 *
 * This pulls ALL claims (opened + closed, paginated), keeps only the ones where we
 * are the respondent (seller/sender), classifies the financial outcome, and reflects
 * it on the affected MLOrder (shippingStatus + partialRefundQty + returnShipCost) so
 * Pedidos and the cash reconciliation finally cuadran with returns.
 */

interface ClaimPlayer { role?: string; type?: string; user_id?: number }
interface ClaimResolution { reason?: string; benefited?: string[]; closed_by?: string; applied_coverage?: boolean }
interface Claim {
  id: number;
  resource_id: number;
  status?: string; // opened | closed
  type?: string; // cancel_purchase | mediations | returns
  stage?: string;
  resource?: string; // order | shipment
  quantity_type?: string; // total | partial
  players?: ClaimPlayer[];
  resolution?: ClaimResolution;
  date_created?: string;
}

async function fetchAllClaims(status: "opened" | "closed", maxPages = 30): Promise<Claim[]> {
  const out: Claim[] = [];
  for (let page = 0; page < maxPages; page++) {
    const offset = page * 50;
    const res = await mlFetch<{ data?: Claim[]; paging?: { total: number } }>(
      `/post-purchase/v1/claims/search`,
      { params: { status, limit: "50", offset: String(offset), sort: "date_created,desc" } }
    ).catch(() => null);
    const data = res?.data || [];
    out.push(...data);
    if (data.length < 50) break;
    if (offset + 50 >= (res?.paging?.total || 0)) break;
  }
  return out;
}

// Did the seller (us) actually lose money on this claim? Opened claims are provisional losses.
function sellerLost(claim: Claim): { loss: boolean; provisional: boolean } {
  if (claim.status !== "closed") return { loss: true, provisional: true };
  const benefited = claim.resolution?.benefited || [];
  // buyer (complainant) benefited → we refunded/lost. respondent/empty → we kept the money.
  return { loss: benefited.includes("complainant"), provisional: false };
}

function targetStatus(claim: Claim): ShippingStatus {
  if (claim.type === "cancel_purchase") return "CANCELLED";
  return "RETURNED"; // returns + mediations that we lost = product back / refunded
}

export async function POST(request: Request) {
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const creds = await getMLCredentials();
  if (!creds) return NextResponse.json({ error: "Sin credenciales ML" }, { status: 400 });
  const myId = Number(creds.mlUserId);

  let claims: Claim[] = [];
  try {
    const [opened, closed] = await Promise.all([fetchAllClaims("opened"), fetchAllClaims("closed")]);
    claims = [...opened, ...closed];
  } catch (e) {
    return NextResponse.json({ error: "Error consultando claims ML", detail: String(e) }, { status: 502 });
  }

  // Keep only claims where WE are the respondent (seller/sender) — exclude claims where we are the buyer.
  const mine = claims.filter((c) =>
    (c.players || []).some((p) => p.user_id === myId && (p.role === "respondent"))
  );

  // Resolve target orders. resource=order → resource_id is the order id; resource=shipment → it's a shipment id.
  const byOrderId = new Map<string, Claim>(); // mlOrderId(string) → strongest claim
  const byShipmentId = new Map<string, Claim>();
  const rank = (c: Claim) => (sellerLost(c).loss ? (c.status === "closed" ? 3 : 2) : 1); // prefer confirmed losses
  for (const c of mine) {
    const key = String(c.resource_id);
    const map = c.resource === "shipment" ? byShipmentId : byOrderId;
    const prev = map.get(key);
    if (!prev || rank(c) > rank(prev)) map.set(key, c);
  }

  const orderIds = [...byOrderId.keys()].map((s) => BigInt(s));
  const shipmentIds = [...byShipmentId.keys()].map((s) => BigInt(s));

  const orders = await prisma.mLOrder.findMany({
    where: { OR: [{ mlOrderId: { in: orderIds } }, { shipmentId: { in: shipmentIds } }] },
    select: { id: true, mlOrderId: true, shipmentId: true, shippingStatus: true, returnShipCost: true, partialRefundQty: true },
  });

  let returns = 0, cancels = 0, won = 0, freightFetched = 0, partials = 0, notFound = 0;
  let freightBudget = 200; // bound per-claim shipment fetches to stay within time
  const sample: Array<{ mlOrderId: string; from: string; to: string; type?: string; status?: string; benefited?: string[] }> = [];

  const resolveClaim = (o: { mlOrderId: bigint; shipmentId: bigint | null }): Claim | undefined =>
    byOrderId.get(o.mlOrderId.toString()) || (o.shipmentId ? byShipmentId.get(o.shipmentId.toString()) : undefined);

  const seenOrderKeys = new Set<string>();
  for (const o of orders) {
    const claim = resolveClaim(o);
    if (!claim) continue;
    seenOrderKeys.add(byOrderId.has(o.mlOrderId.toString()) ? `o:${o.mlOrderId}` : `s:${o.shipmentId}`);

    const { loss } = sellerLost(claim);
    if (!loss) { won++; continue; } // we won → not a return, leave the order as-is

    const newStatus = targetStatus(claim);
    const data: Record<string, unknown> = {};

    // Don't downgrade an already-final return; only set if different and not already RETURNED.
    if (order_isUpgrade(o.shippingStatus, newStatus)) {
      data.shippingStatus = newStatus;
    }

    // Partial refund (quantity_type=partial) — flag if not already.
    if (claim.quantity_type === "partial" && o.partialRefundQty === 0) {
      data.partialRefundQty = 1; // at least one unit; refined by sync-status from the order payload
      partials++;
    }

    // Return freight (only for actual returns, when we don't have it yet, bounded).
    if (newStatus === "RETURNED" && o.returnShipCost == null && freightBudget > 0) {
      freightBudget--;
      try {
        const detail = await mlFetch<{ title?: string }>(`/post-purchase/v1/claims/${claim.id}/detail`).catch(() => ({ title: "" }));
        const covered = (detail.title || "").toLowerCase().includes("sin costo");
        if (covered) {
          data.returnShipCost = 0;
        } else if (o.shipmentId) {
          const sh = await mlFetch<{ base_cost?: number }>(`/shipments/${o.shipmentId}`).catch(() => ({ base_cost: undefined }));
          data.returnShipCost = sh.base_cost ?? 0;
        }
        if (data.returnShipCost !== undefined) freightFetched++;
      } catch { /* skip freight on error */ }
    }

    if (Object.keys(data).length > 0) {
      if (data.shippingStatus && sample.length < 40) {
        sample.push({ mlOrderId: o.mlOrderId.toString(), from: o.shippingStatus, to: String(data.shippingStatus), type: claim.type, status: claim.status, benefited: claim.resolution?.benefited });
      }
      if (!dryRun) await prisma.mLOrder.update({ where: { id: o.id }, data });
      if (newStatus === "CANCELLED") cancels++; else returns++;
    }
  }

  notFound = byOrderId.size + byShipmentId.size - seenOrderKeys.size;

  return NextResponse.json({
    dryRun,
    claimsTotal: claims.length,
    mine: mine.length,
    distinctTargets: byOrderId.size + byShipmentId.size,
    matchedOrders: orders.length,
    returns,
    cancels,
    partials,
    wonByUs: won,
    freightFetched,
    notFoundLocally: notFound,
    sample,
  });
}

// Only move "forward" to a return/cancel state; never overwrite an existing RETURNED.
function order_isUpgrade(current: string, next: ShippingStatus): boolean {
  if (current === "RETURNED") return false;
  if (current === "NOT_DELIVERED" && next !== "RETURNED") return false;
  return current !== next;
}
