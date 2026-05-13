export const dynamic = "force-dynamic";

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
  const orders = await prisma.mLOrder.findMany({
    where: {
      shippingStatus: { notIn: ["DELIVERED", "RETURNED", "CANCELLED"] },
      shipmentId: { not: null },
    },
    select: { id: true, mlOrderId: true, shipmentId: true, shippingStatus: true, prepStatus: true },
    orderBy: { dateCreated: "desc" },
    take: 200,
  });

  let updated = 0;
  for (const order of orders) {
    if (!order.shipmentId) continue;
    try {
      const shipment = await mlFetch<{ status?: string; substatus?: string }>(
        `/shipments/${order.shipmentId}`
      );
      const newStatus = mapShipmentStatus(shipment.status, shipment.substatus);
      if (newStatus !== order.shippingStatus) {
        const data: { shippingStatus: ShippingStatus; prepStatus?: "SHIPPED" } = { shippingStatus: newStatus };
        if ((newStatus === "SHIPPED" || newStatus === "DELIVERED") && order.prepStatus !== "SHIPPED") {
          data.prepStatus = "SHIPPED";
        }
        await prisma.mLOrder.update({ where: { id: order.id }, data });
        updated++;
      }
    } catch {
      // skip if shipment not accessible
    }
  }

  return NextResponse.json({ checked: orders.length, updated });
}
