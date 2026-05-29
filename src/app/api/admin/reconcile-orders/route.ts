export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mlFetch } from "@/lib/ml/client";
import { Prisma, type ShippingStatus } from "@prisma/client";

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
const HANDED_OFF = ["dropped_off", "picked_up", "in_hub", "in_transit", "waiting_for_withdrawal", "out_for_delivery", "at_sender", "at_agency"];

// Drains backfilled/stuck PENDING orders by fetching each one's real shipment
// status (oldest-first), so delivered ones leave the Preparar list and genuine
// pending ones (e.g. ready_to_ship) surface correctly. Call until remaining=0.
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const check = url.searchParams.get("check");
  if (check) {
    const ord = await prisma.mLOrder.findUnique({ where: { mlOrderId: BigInt(check) } });
    const listing = ord ? await prisma.mLListing.findUnique({ where: { mlItemId: ord.mlItemId }, select: { mlItemId: true, packId: true } }) : null;
    return NextResponse.json({ exists: !!ord, order: ord ? { mlOrderId: String(ord.mlOrderId), mlItemId: ord.mlItemId, status: ord.status, shippingStatus: ord.shippingStatus, prepStatus: ord.prepStatus, logisticType: ord.logisticType, shipmentId: ord.shipmentId ? String(ord.shipmentId) : null, dateCreated: ord.dateCreated } : null, listingLinked: !!listing });
  }
  // One-time remediation: orders that are ready_to_ship / pending but flagged
  // SHIPPED were mis-marked by the old auto-ship heuristic and are hidden from
  // Preparar (= missed venta). Bring them back to NEW so the seller sees them.
  if (url.searchParams.get("healMismarked") === "true") {
    const r = await prisma.mLOrder.updateMany({
      where: { prepStatus: "SHIPPED", shippingStatus: { in: ["READY_TO_SHIP", "PENDING"] } },
      data: { prepStatus: "NEW" },
    });
    return NextResponse.json({ healed: r.count });
  }

  const batch = parseInt(url.searchParams.get("batch") || "200", 10);
  // scope=eligible re-verifies EVERY order currently shown in Preparar against
  // ML's real shipment status (so already-shipped orders that were resurfaced
  // get marked SHIPPED and leave). scope=pending (default) only drains PENDING.
  const eligible = url.searchParams.get("scope") === "eligible";
  const whereClause: Prisma.MLOrderWhereInput = eligible
    ? { shippingStatus: { in: ["PENDING", "READY_TO_SHIP", "NOT_DELIVERED"] }, prepStatus: { in: ["NEW", "PREPARING", "READY"] } }
    : { shippingStatus: "PENDING" };

  const pending = await prisma.mLOrder.findMany({
    where: whereClause,
    select: { id: true, mlOrderId: true, shipmentId: true, prepStatus: true },
    orderBy: { dateCreated: "asc" },
    take: batch,
  });

  let updated = 0, noShipment = 0, errors = 0, markedShipped = 0;
  for (const o of pending) {
    try {
      let shipmentId = o.shipmentId;
      let unitPrice: number | null = null;
      if (!shipmentId) {
        const ord = await mlFetch<{ shipping?: { id: number }; order_items?: Array<{ unit_price: number }> }>(`/orders/${o.mlOrderId}`);
        if (ord.shipping?.id) shipmentId = BigInt(ord.shipping.id);
        unitPrice = ord.order_items?.[0]?.unit_price ?? null;
      }
      if (!shipmentId) { noShipment++; continue; }
      const sh = await mlFetch<{ status?: string; substatus?: string; logistic_type?: string }>(`/shipments/${shipmentId}`);
      const newStatus = mapShipmentStatus(sh.status, sh.substatus);
      const data: Record<string, unknown> = { shippingStatus: newStatus, shipmentId };
      if (sh.logistic_type) data.logisticType = sh.logistic_type;
      if ((newStatus === "SHIPPED" || newStatus === "DELIVERED") && o.prepStatus !== "SHIPPED") {
        data.prepStatus = "SHIPPED";
        markedShipped++;
      }
      if (unitPrice != null) data.unitPrice = unitPrice;
      await prisma.mLOrder.update({ where: { id: o.id }, data });
      updated++;
    } catch { errors++; }
  }

  const remaining = await prisma.mLOrder.count({ where: { shippingStatus: "PENDING" } });
  return NextResponse.json({ processed: pending.length, updated, markedShipped, noShipment, errors, remainingPending: remaining });
}
