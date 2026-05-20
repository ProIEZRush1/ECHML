export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { PrepararContent } from "./preparar-content";

export default async function PrepararPage() {
  const [orders, groups, todayShipped] = await Promise.all([
    prisma.mLOrder.findMany({
      where: {
        shippingStatus: { in: ["PENDING", "READY_TO_SHIP", "SHIPPED"] },
        prepStatus: { in: ["NEW", "PREPARING", "READY"] },
        logisticType: { not: "fulfillment" },
      },
      orderBy: { dateCreated: "asc" },
      take: 200,
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

  const mlItemIds = [...new Set(orders.map((o) => o.mlItemId))];
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

  // Get ML pack IDs from MPTransaction for these orders
  const orderIds = orders.map((o) => o.mlOrderId);
  const packIdTxs = await prisma.mPTransaction.findMany({
    where: { mlOrderId: { in: orderIds }, mlPackId: { not: null } },
    select: { mlOrderId: true, mlPackId: true },
  });
  const packIdMap = new Map(packIdTxs.map((t) => [String(t.mlOrderId), String(t.mlPackId)]));

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
      listing: allListings[0].listing,
      stockAlert: false,
      subOrders: allListings.length > 1 ? allListings : null,
      orderIds: group.map((o) => o.id),
    };
  });

  const groupsData = groups.map((g) => ({
    id: g.id,
    name: g.name,
    color: g.color,
    productIds: g.items.map((i) => i.productId),
  }));

  const totalNew = enrichedOrders.filter((o) => o.prepStatus === "NEW").length;
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
        groups={groupsData}
        kpis={{ totalNew, totalPreparing, totalReady, todayShipped }}
      />
    </div>
  );
}
