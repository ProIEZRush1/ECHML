export const dynamic = "force-dynamic";
export const maxDuration = 120;

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mlFetch } from "@/lib/ml/client";
import type { ShippingStatus } from "@prisma/client";

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

  // Check non-delivered orders + recently delivered ones (to catch returns after delivery)
  const orders = await prisma.mLOrder.findMany({
    where: {
      OR: [
        { shippingStatus: { notIn: ["DELIVERED", "RETURNED", "CANCELLED"] } },
        { shippingStatus: "DELIVERED", dateCreated: { gte: thirtyDaysAgo } },
      ],
    },
    select: { id: true, mlOrderId: true, shipmentId: true, shippingStatus: true, prepStatus: true },
    orderBy: { dateCreated: "desc" },
    take: 400,
  });

  let updated = 0;
  let shipmentsFetched = 0;

  for (const order of orders) {
    let shipmentId = order.shipmentId;

    // If no shipmentId, try to get it from the order
    if (!shipmentId) {
      try {
        const mlOrder = await mlFetch<{ shipping?: { id: number } }>(`/orders/${order.mlOrderId}`);
        if (mlOrder.shipping?.id) {
          shipmentId = BigInt(mlOrder.shipping.id);
          await prisma.mLOrder.update({
            where: { id: order.id },
            data: { shipmentId },
          });
          shipmentsFetched++;
        }
      } catch {
        continue;
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

      const handedOff = ["dropped_off", "picked_up", "in_hub", "in_transit", "waiting_for_withdrawal", "out_for_delivery", "at_sender", "at_agency"].includes(shipment.substatus || "");
      if ((newStatus === "SHIPPED" || newStatus === "DELIVERED" || handedOff) && order.prepStatus !== "SHIPPED") {
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

  // Check for partially refunded orders — detect and store refund qty
  let partialRefundsFound = 0;
  try {
    const partialData = await mlFetch<{ results: Array<{ id: number }>, paging: { total: number } }>(
      `/orders/search`,
      { params: { seller: "{userId}", "order.status": "partially_refunded", sort: "date_desc", limit: "50",
        "order.date_created.from": thirtyDaysAgo.toISOString() } }
    );
    for (const po of partialData.results || []) {
      const mlOrderId = BigInt(po.id);
      const order = await prisma.mLOrder.findUnique({ where: { mlOrderId } });
      if (!order || order.partialRefundQty > 0) continue;

      try {
        const mlOrder = await mlFetch<{
          order_items: Array<{ quantity: number; unit_price: number }>;
          payments: Array<{ transaction_amount_refunded: number }>;
        }>(`/orders/${po.id}`);

        const unitPrice = mlOrder.order_items?.[0]?.unit_price || 0;
        const refunded = mlOrder.payments?.[0]?.transaction_amount_refunded || 0;
        const refundedQty = unitPrice > 0 ? Math.round(refunded / unitPrice) : 0;

        if (refundedQty > 0) {
          await prisma.mLOrder.update({
            where: { id: order.id },
            data: { partialRefundQty: refundedQty, status: "partially_refunded" },
          });
          partialRefundsFound++;
        }
      } catch { /* skip individual order errors */ }
    }
  } catch { /* ML API error */ }

  return NextResponse.json({ checked: orders.length, updated, shipmentsFetched, claimsFound, partialRefundsFound });
}
