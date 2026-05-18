export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { PackageCheck } from "lucide-react";
import Image from "next/image";
import type { PrepStatus } from "@prisma/client";
import { PrepActions } from "./prep-actions";
import { SyncStatusButton } from "../pedidos/sync-status-button";

export default async function PrepararPage() {
  const orders = await prisma.mLOrder.findMany({
    where: {
      shippingStatus: { in: ["PENDING", "READY_TO_SHIP", "SHIPPED"] },
      prepStatus: { in: ["NEW", "PREPARING", "READY"] },
      logisticType: { not: "fulfillment" },
    },
    orderBy: { dateCreated: "asc" },
    take: 200,
  });

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
                  product: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const listingMap = new Map(listings.map((l) => [l.mlItemId, l]));

  const newOrders = orders.filter((o) => o.prepStatus === "NEW");
  const preparingOrders = orders.filter((o) => o.prepStatus === "PREPARING");
  const readyOrders = orders.filter((o) => o.prepStatus === "READY");

  const totalNew = newOrders.length;
  const totalPreparing = preparingOrders.length;
  const totalReady = readyOrders.length;

  const todayShipped = await prisma.mLOrder.count({
    where: {
      prepStatus: "SHIPPED",
      updatedAt: { gte: new Date(new Date().toISOString().split("T")[0] + "T00:00:00Z") },
    },
  });

  type OrderWithListing = typeof orders[number] & {
    listing: typeof listings[number] | null;
    stockAlert: boolean;
  };

  const enrichedOrders: OrderWithListing[] = orders.map((o) => {
    const listing = listingMap.get(o.mlItemId) || null;
    const stockAlert = listing ? listing.pack.stock <= 0 : false;
    return { ...o, listing, stockAlert };
  });

  const sections: { title: string; status: PrepStatus; orders: OrderWithListing[]; color: string }[] = [
    { title: `Nuevos (${totalNew})`, status: "NEW", orders: enrichedOrders.filter((o) => o.prepStatus === "NEW"), color: "oklch(0.58 0.16 22)" },
    { title: `Preparando (${totalPreparing})`, status: "PREPARING", orders: enrichedOrders.filter((o) => o.prepStatus === "PREPARING"), color: "oklch(0.60 0.14 78)" },
    { title: `Listos para Enviar (${totalReady})`, status: "READY", orders: enrichedOrders.filter((o) => o.prepStatus === "READY"), color: "oklch(0.55 0.12 200)" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PageHeader
          title="Preparar Envios"
          description="Ordenes pendientes de empaque y envio (excluye Mercado Envios Full)"
        />
        <SyncStatusButton />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Nuevos", value: totalNew, cls: "margin-bad" },
          { label: "Preparando", value: totalPreparing, cls: "margin-warn" },
          { label: "Listos", value: totalReady, style: { color: "oklch(0.55 0.12 200)" } as React.CSSProperties },
          { label: "Enviados Hoy", value: todayShipped, cls: "margin-good" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-[9px] border border-border bg-card px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{kpi.label}</p>
            <p className={`text-xl font-bold mt-0.5 num ${kpi.cls || ""}`} style={kpi.style}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={PackageCheck}
          title="Todo al dia"
          description="No hay ordenes pendientes de preparar. Sincroniza ordenes para ver nuevos pedidos."
        />
      ) : (
        sections.map((section) => {
          if (section.orders.length === 0) return null;
          return (
            <div key={section.status} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: section.color }} />
                <h2 className="text-[14px] font-semibold">{section.title}</h2>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {section.orders.map((order) => {
                  const listing = order.listing;
                  const pack = listing?.pack;
                  return (
                    <div
                      key={order.id}
                      className={`rounded-[9px] border bg-card px-3 py-2.5 space-y-2 ${
                        order.stockAlert ? "border-red-400 dark:border-red-800" : "border-border"
                      }`}
                    >
                      {/* Pack + meta */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        {pack?.imageUrl && (
                          <div className="shrink-0 h-10 w-10 rounded-md overflow-hidden border bg-muted">
                            <Image src={pack.imageUrl} alt={pack.name} width={40} height={40} className="h-full w-full object-cover" unoptimized />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-[12px] truncate">{pack?.name || order.mlItemId}</p>
                          <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground mt-0.5">
                            {pack?.sku && <span className="mono">{pack.sku}</span>}
                            <span className="text-border">·</span>
                            <span className="font-semibold text-foreground">×{order.quantity}</span>
                            {order.buyerNickname && (
                              <>
                                <span className="text-border">·</span>
                                <span className="truncate">{order.buyerNickname}</span>
                              </>
                            )}
                          </div>
                        </div>
                        {order.stockAlert && (
                          <span className="shrink-0 text-[9px] font-semibold text-red-500 uppercase">Sin stock</span>
                        )}
                      </div>

                      {/* Pack contents */}
                      {pack?.items && pack.items.length > 0 && (
                        <div className="border-t border-border pt-1.5 space-y-0.5">
                          {pack.items.map((item, idx) => {
                            const totalNeeded = item.quantity * order.quantity;
                            const label = item.productVariant.variantLabel || item.productVariant.product.name;
                            const lowStock = item.productVariant.stock < totalNeeded;
                            return (
                              <div key={idx} className="flex items-center justify-between text-[11px]">
                                <span className={lowStock ? "text-red-500" : "text-muted-foreground"}>
                                  {totalNeeded}× {label}
                                </span>
                                <span className={`mono text-[10px] ${lowStock ? "text-red-500 font-semibold" : "text-muted-foreground"}`}>
                                  ({item.productVariant.stock} disp.)
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Actions */}
                      <PrepActions orderId={order.id} currentStatus={order.prepStatus} />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
