export const dynamic = "force-dynamic";
export const maxDuration = 120;

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mlFetch, getMLCredentials } from "@/lib/ml/client";
import type { ShippingStatus } from "@prisma/client";

interface MLOrderSearchResult {
  id: number;
  status?: string;
  date_created?: string;
  order_items?: Array<{ item?: { id?: string }; quantity?: number; unit_price?: number }>;
  shipping?: { id?: number };
}

// SAFETY-CRITICAL: pull recent orders straight from ML and create any MLOrder
// that's missing locally — so a venta can never be absent from Preparar, even
// if its listing is closed/unknown or a webhook/MP-sync was missed.
async function backfillMissingOrders(): Promise<number> {
  const creds = await getMLCredentials();
  if (!creds) return 0;
  const sellerId = creds.mlUserId.toString();
  const from = new Date();
  from.setDate(from.getDate() - 60);
  const fromISO = from.toISOString();
  let created = 0;
  let offset = 0;
  for (let page = 0; page < 12; page++) {
    const res = await mlFetch<{ results: MLOrderSearchResult[]; paging: { total: number } }>(
      `/orders/search?seller=${sellerId}&order.date_created.from=${encodeURIComponent(fromISO)}&sort=date_desc&offset=${offset}&limit=50`
    ).catch(() => null);
    if (!res?.results?.length) break;
    const valid = res.results.filter((o) => o.id && o.order_items?.[0]?.item?.id);
    const ids = valid.map((o) => BigInt(o.id));
    const present = new Set(
      (await prisma.mLOrder.findMany({ where: { mlOrderId: { in: ids } }, select: { mlOrderId: true } })).map((r) => r.mlOrderId.toString())
    );
    for (const o of valid) {
      if (present.has(String(o.id))) continue; // never clobber existing prep progress
      const item = o.order_items![0];
      try {
        await prisma.mLOrder.create({
          data: {
            mlOrderId: BigInt(o.id),
            mlItemId: item.item!.id!,
            quantity: item.quantity || 1,
            unitPrice: item.unit_price || 0,
            totalAmount: (item.unit_price || 0) * (item.quantity || 1),
            status: o.status || "paid",
            shippingStatus: "PENDING",
            prepStatus: "NEW",
            shipmentId: o.shipping?.id ? BigInt(o.shipping.id) : null,
            dateCreated: o.date_created ? new Date(o.date_created) : new Date(),
          },
        });
        created++;
      } catch { /* unique race or bad row — skip */ }
    }
    offset += 50;
    if (offset >= (res.paging?.total || 0)) break;
  }
  return created;
}

function mapShipmentStatus(status?: string, substatus?: string): ShippingStatus {
  if (status === "not_delivered" && substatus === "returned") return "RETURNED";
  switch (status) {
    case "ready_to_ship": return "READY_TO_SHIP";
    case "shipped": return "SHIPPED";
    case "delivered": return "DELIVERED";
    case "not_delivered": return "NOT_DELIVERED";
    case "cancelled": return "CANCELLED";
    default: return "PENDING";
  }
}

export async function POST() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // STEP 0: backfill any orders missing locally (closed listings, missed webhooks)
  let backfilled = 0;
  try { backfilled = await backfillMissingOrders(); } catch { /* don't block status sync */ }

  // Check non-delivered orders + recently delivered ones (to catch returns after delivery)
  const orders = await prisma.mLOrder.findMany({
    where: {
      OR: [
        { shippingStatus: { notIn: ["DELIVERED", "RETURNED", "CANCELLED"] } },
        { shippingStatus: "DELIVERED", dateCreated: { gte: thirtyDaysAgo } },
      ],
    },
    select: { id: true, mlOrderId: true, shipmentId: true, shippingStatus: true, prepStatus: true, partialRefundQty: true },
    orderBy: { dateCreated: "desc" },
    take: 400,
  });

  let updated = 0;
  let shipmentsFetched = 0;

  for (const order of orders) {
    let shipmentId = order.shipmentId;

    // Fetch ML order data once — used for shipmentId + partial refund check
    let mlOrderData: {
      shipping?: { id: number };
      status?: string;
      order_items?: Array<{ unit_price: number }>;
      payments?: Array<{ transaction_amount_refunded: number }>;
    } | null = null;

    if (!shipmentId || order.partialRefundQty === 0) {
      try {
        mlOrderData = await mlFetch(`/orders/${order.mlOrderId}`);
      } catch {
        continue;
      }
    }

    if (!shipmentId && mlOrderData?.shipping?.id) {
      shipmentId = BigInt(mlOrderData.shipping.id);
      await prisma.mLOrder.update({
        where: { id: order.id },
        data: { shipmentId },
      });
      shipmentsFetched++;
    }

    if (order.partialRefundQty === 0 && mlOrderData?.status === "partially_refunded") {
      const unitPrice = mlOrderData.order_items?.[0]?.unit_price || 0;
      const refunded = mlOrderData.payments?.[0]?.transaction_amount_refunded || 0;
      const refundedQty = unitPrice > 0 ? Math.round(refunded / unitPrice) : 0;
      if (refundedQty > 0) {
        await prisma.mLOrder.update({
          where: { id: order.id },
          data: { partialRefundQty: refundedQty, status: "partially_refunded" },
        });
        updated++;
      }
    }

    if (!shipmentId) continue;

    try {
      const shipment = await mlFetch<{ status?: string; substatus?: string; logistic_type?: string }>(
        `/shipments/${shipmentId}`
      );
      const newStatus = mapShipmentStatus(shipment.status, shipment.substatus);
      const data: Record<string, unknown> = {};
      let changed = false;

      if (newStatus !== order.shippingStatus) {
        data.shippingStatus = newStatus;
        changed = true;
      }

      // Only auto-mark SHIPPED when genuinely shipped/delivered. The old
      // "handedOff substatus" heuristic could mark a still-ready_to_ship order
      // as SHIPPED on a transient state, permanently hiding it from Preparar
      // (= missed venta). Once truly shipped, status becomes SHIPPED anyway.
      if ((newStatus === "SHIPPED" || newStatus === "DELIVERED") && order.prepStatus !== "SHIPPED") {
        data.prepStatus = "SHIPPED";
        changed = true;
      }

      if (shipment.logistic_type) {
        data.logisticType = shipment.logistic_type;
        changed = true;
      }

      if (changed) {
        await prisma.mLOrder.update({ where: { id: order.id }, data });
        updated++;
      }
    } catch {
      // skip if shipment not accessible
    }
  }

  // Check for cancelled orders from ML API
  try {
    const cancelledData = await mlFetch<{ results: Array<{ id: number }>, paging: { total: number } }>(
      `/orders/search`,
      { params: { seller: "{userId}", "order.status": "cancelled", sort: "date_desc", limit: "50",
        "order.date_created.from": thirtyDaysAgo.toISOString() } }
    );
    for (const co of cancelledData.results || []) {
      const mlOrderId = BigInt(co.id);
      try {
        await prisma.mLOrder.updateMany({
          where: { mlOrderId, shippingStatus: { not: "CANCELLED" } },
          data: { shippingStatus: "CANCELLED" },
        });
      } catch { /* skip */ }
    }
  } catch { /* ML API error */ }

  // Also check ML claims API for returns/mediations
  let claimsFound = 0;
  try {
    const claimsData = await mlFetch<{ data: Array<{ resource_id: number; type: string; status: string }> }>(
      `/post-purchase/v1/claims/search`,
      { params: { status: "opened", role: "defendant", limit: "50" } }
    );

    for (const claim of (claimsData.data || []) as Array<{ id: number; resource_id: number; type: string; status: string }>) {
      const mlOrderId = BigInt(claim.resource_id);
      const order = await prisma.mLOrder.findUnique({ where: { mlOrderId } });
      if (!order) continue;

      const data: Record<string, unknown> = {};
      if (order.shippingStatus !== "RETURNED" && order.shippingStatus !== "NOT_DELIVERED") {
        data.shippingStatus = claim.type === "returns" ? "RETURNED" : "NOT_DELIVERED";
      }

      // Fetch return shipping cost from claim detail + shipment base_cost
      if (order.returnShipCost === null) {
        try {
          const detail = await mlFetch<{ title?: string }>(`/post-purchase/v1/claims/${claim.id}/detail`);
          const covered = (detail.title || "").toLowerCase().includes("sin costo");
          if (covered) {
            data.returnShipCost = 0;
          } else if (order.shipmentId) {
            const shipment = await mlFetch<{ base_cost?: number }>(`/shipments/${order.shipmentId}`);
            data.returnShipCost = shipment.base_cost || 0;
          }
        } catch { /* skip */ }
      }

      if (Object.keys(data).length > 0) {
        await prisma.mLOrder.update({ where: { id: order.id }, data });
        claimsFound++;
      }
    }
  } catch {
    // claims API not available
  }

  return NextResponse.json({ checked: orders.length, backfilled, updated, shipmentsFetched, claimsFound });
}
