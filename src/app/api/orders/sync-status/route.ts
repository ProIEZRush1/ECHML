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

      const handedOff = ["dropped_off", "picked_up", "in_hub", "in_transit"].includes(shipment.substatus || "");
      if ((newStatus === "DELIVERED" || handedOff) && order.prepStatus !== "SHIPPED") {
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

  return NextResponse.json({ checked: orders.length, updated, shipmentsFetched });
}
