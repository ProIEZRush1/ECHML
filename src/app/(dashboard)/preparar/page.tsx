export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { SyncStatusButton } from "../pedidos/sync-status-button";
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

  const enrichedOrders = orders.map((o) => {
    const listing = listingMap.get(o.mlItemId) || null;
    const stockAlert = listing ? listing.pack.stock <= 0 : false;
    return {
      id: o.id,
      mlItemId: o.mlItemId,
      mlOrderId: String(o.mlOrderId),
      quantity: o.quantity,
      buyerNickname: o.buyerNickname,
      prepStatus: o.prepStatus,
      listing,
      stockAlert,
    };
  });

  const groupsData = groups.map((g) => ({
    id: g.id,
    name: g.name,
    color: g.color,
    productIds: g.items.map((i) => i.productId),
  }));

  const totalNew = orders.filter((o) => o.prepStatus === "NEW").length;
  const totalPreparing = orders.filter((o) => o.prepStatus === "PREPARING").length;
  const totalReady = orders.filter((o) => o.prepStatus === "READY").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PageHeader
          title="Preparar Envios"
          description="Ordenes pendientes de empaque y envio"
        />
        <SyncStatusButton />
      </div>

      <PrepararContent
        orders={enrichedOrders}
        groups={groupsData}
        kpis={{ totalNew, totalPreparing, totalReady, todayShipped }}
      />
    </div>
  );
}
