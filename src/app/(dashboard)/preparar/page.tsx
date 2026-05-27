export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { PrepararContent } from "./preparar-content";
import { mlFetch } from "@/lib/ml/client";

export default async function PrepararPage() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [orders, cancelledOrders, groups, todayShipped] = await Promise.all([
    prisma.mLOrder.findMany({
      where: {
        shippingStatus: { in: ["PENDING", "READY_TO_SHIP", "SHIPPED"] },
        prepStatus: { in: ["NEW", "PREPARING", "READY"] },
        logisticType: { not: "fulfillment" },
      },
      orderBy: { dateCreated: "asc" },
      take: 200,
    }),
    prisma.mLOrder.findMany({
      where: {
        shippingStatus: { in: ["CANCELLED"] },
        dateCreated: { gte: sevenDaysAgo },
        logisticType: { not: "fulfillment" },
      },
      orderBy: { dateCreated: "desc" },
      take: 50,
    }),
    prisma.productGroup.findMany({
      include: { items: { select: { productId: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.mLOrder.count({
      where: {
        prepStatus: "SHIPPED",
        updatedAt: { gte: new Date(new Date().toISOString().split("T")[0] + "T00:00:00Z") },
      },
    }),
  ]);

  const allOrders = [...orders, ...cancelledOrders];
  const mlItemIds = [...new Set(allOrders.map((o) => o.mlItemId))];
  const listings = await prisma.mLListing.findMany({
    where: { mlItemId: { in: mlItemIds } },
    select: {
      mlItemId: true,
      title: true,
      pack: {
        select: {
          id: true,
          sku: true,
          name: true,
          imageUrl: true,
          stock: true,
          items: {
            select: {
              quantity: true,
              productVariant: {
                select: {
                  variantLabel: true,
                  color: true,
                  stock: true,
                  product: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const listingMap = new Map(listings.map((l) => [l.mlItemId, l]));

  // Get ML pack IDs: try MPTransaction first, then rawPayload fallback
  const orderIds = orders.map((o) => o.mlOrderId);
  const packIdTxs = await prisma.mPTransaction.findMany({
    where: { mlOrderId: { in: orderIds }, mlPackId: { not: null } },
    select: { mlOrderId: true, mlPackId: true },
  });
  const packIdMap = new Map(packIdTxs.map((t) => [String(t.mlOrderId), String(t.mlPackId)]));
  for (const o of orders) {
    const key = String(o.mlOrderId);
    if (!packIdMap.has(key)) {
      const raw = o.rawPayload as Record<string, unknown> | null;
      if (raw?.pack_id) packIdMap.set(key, String(raw.pack_id));
    }
  }
  // Fetch pack_id from ML API for orders still missing it
  const missingPackIds = orders.filter((o) => !packIdMap.has(String(o.mlOrderId)));
  if (missingPackIds.length > 0) {
    try {
      const mlOrders = await Promise.all(
        missingPackIds.slice(0, 20).map(async (o) => {
          try {
            const data = await mlFetch<{ id: number; pack_id?: number | null }>(`/orders/${o.mlOrderId}`);
            return { mlOrderId: String(o.mlOrderId), packId: data.pack_id ? String(data.pack_id) : null };
          } catch { return null; }
        })
      );
      for (const r of mlOrders) {
        if (r?.packId) packIdMap.set(r.mlOrderId, r.packId);
      }
    } catch { /* ignore ML API errors */ }
  }

  // Fetch shipping deadlines from ML API (pay_before field)
  const uniqueShipmentIds = [...new Set(orders.filter((o) => o.shipmentId).map((o) => String(o.shipmentId)))];
  const deadlineMap = new Map<string, string>();
  if (uniqueShipmentIds.length > 0) {
    try {
      const shipments = await Promise.all(
        uniqueShipmentIds.slice(0, 30).map(async (sid) => {
          try {
            const data = await mlFetch<{
              id: number;
              shipping_option?: { estimated_delivery_time?: { pay_before?: string } };
            }>(`/shipments/${sid}`);
            const payBefore = data.shipping_option?.estimated_delivery_time?.pay_before;
            return { sid, deadline: payBefore || null };
          } catch { return { sid, deadline: null }; }
        })
      );
      for (const s of shipments) {
        if (s.deadline) deadlineMap.set(s.sid, s.deadline);
      }
    } catch { /* ignore */ }
  }

  // Group orders by shipmentId to merge multi-item purchases into one card
  const ordersByShipment = new Map<string, typeof orders>();
  for (const o of orders) {
    const key = o.shipmentId ? String(o.shipmentId) : o.id;
    const existing = ordersByShipment.get(key) || [];
    existing.push(o);
    ordersByShipment.set(key, existing);
  }

  const enrichedOrders = [...ordersByShipment.values()].map((group) => {
    const primary = group[0];
    const allListings = group.map((o) => {
      const listing = listingMap.get(o.mlItemId) || null;
      return { listing, quantity: o.quantity, mlItemId: o.mlItemId };
    });

    return {
      id: primary.id,
      mlItemId: primary.mlItemId,
      mlOrderId: String(primary.mlOrderId),
      mlPackId: packIdMap.get(String(primary.mlOrderId)) || null,
      shipmentId: primary.shipmentId ? String(primary.shipmentId) : null,
      quantity: primary.quantity,
      buyerNickname: primary.buyerNickname,
      prepStatus: primary.prepStatus,
      shippingStatus: primary.shippingStatus,
      logisticType: primary.logisticType,
      listing: allListings[0].listing,
      stockAlert: false,
      subOrders: allListings.length > 1 ? allListings : null,
      orderIds: group.map((o) => o.id),
      shippingDeadline: primary.shipmentId ? (deadlineMap.get(String(primary.shipmentId)) || null) : null,
      dateCreated: primary.dateCreated.toISOString(),
    };
  });

  const enrichedCancelled = cancelledOrders.map((o) => {
    const listing = listingMap.get(o.mlItemId) || null;
    return {
      id: o.id,
      mlItemId: o.mlItemId,
      mlOrderId: String(o.mlOrderId),
      mlPackId: packIdMap.get(String(o.mlOrderId)) || null,
      shipmentId: o.shipmentId ? String(o.shipmentId) : null,
      quantity: o.quantity,
      buyerNickname: o.buyerNickname,
      listing,
      logisticType: o.logisticType,
      dateCreated: o.dateCreated.toISOString(),
    };
  });

  const groupsData = groups.map((g) => ({
    id: g.id,
    name: g.name,
    color: g.color,
    productIds: g.items.map((i) => i.productId),
  }));

  const totalNew = enrichedOrders.filter((o) => o.prepStatus === "NEW" && o.shipmentId).length;
  const totalPending = enrichedOrders.filter((o) => o.prepStatus === "NEW" && !o.shipmentId).length;
  const totalPreparing = enrichedOrders.filter((o) => o.prepStatus === "PREPARING").length;
  const totalReady = enrichedOrders.filter((o) => o.prepStatus === "READY").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PageHeader
          title="Preparar Envios"
          description="Ordenes pendientes de empaque y envio"
        />
      </div>

      <PrepararContent
        orders={enrichedOrders}
        cancelledOrders={enrichedCancelled}
        groups={groupsData}
        kpis={{ totalNew, totalPending, totalPreparing, totalReady, todayShipped, totalCancelled: enrichedCancelled.length }}
      />
    </div>
  );
}
