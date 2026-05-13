export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { PackageCheck } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import Image from "next/image";
import type { PrepStatus } from "@prisma/client";
import { PrepActions } from "./prep-actions";
import { SyncStatusButton } from "../pedidos/sync-status-button";

const PREP_CONFIG: Record<PrepStatus, { label: string; css: string }> = {
  NEW: { label: "Nuevo", css: "tx-pill expense" },
  PREPARING: { label: "Preparando", css: "tx-pill flex" },
  READY: { label: "Listo", css: "tx-pill shipping" },
  SHIPPED: { label: "Enviado", css: "tx-pill sale" },
};

const LABEL_DOT: Record<string, string> = {
  "Blanco": "bg-white border border-gray-300", "Negro": "bg-black", "Gris": "bg-gray-400",
  "Multicolor": "bg-gradient-to-r from-blue-500 via-green-500 to-pink-500",
  "Azul": "bg-blue-500", "Verde": "bg-green-500", "Rosa": "bg-pink-400", "Morado": "bg-purple-500",
};
const ENUM_DOT: Record<string, string> = {
  AZUL: "bg-blue-500", VERDE: "bg-green-500", ROSA: "bg-pink-400", MORADO: "bg-purple-500",
};

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
                select: { color: true, variantLabel: true, stock: true, product: { select: { name: true } } },
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
      <div className="flex items-center justify-between">
        <PageHeader
          title="Preparar Envios"
          description="Ordenes pendientes de empaque y envio (excluye Mercado Envios Full)"
        />
        <SyncStatusButton />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-[9px] border border-border bg-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Nuevos</p>
          <p className="text-2xl font-bold mt-1 num margin-bad">{totalNew}</p>
        </div>
        <div className="rounded-[9px] border border-border bg-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Preparando</p>
          <p className="text-2xl font-bold mt-1 num margin-warn">{totalPreparing}</p>
        </div>
        <div className="rounded-[9px] border border-border bg-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Listos</p>
          <p className="text-2xl font-bold mt-1 num" style={{ color: "oklch(0.55 0.12 200)" }}>{totalReady}</p>
        </div>
        <div className="rounded-[9px] border border-border bg-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Enviados Hoy</p>
          <p className="text-2xl font-bold mt-1 num margin-good">{todayShipped}</p>
        </div>
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
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {section.orders.map((order) => {
                  const listing = order.listing;
                  const pack = listing?.pack;
                  return (
                    <div
                      key={order.id}
                      className={`rounded-[9px] border bg-card p-4 space-y-3 ${
                        order.stockAlert ? "border-red-400 dark:border-red-800" : "border-border"
                      }`}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          {pack?.imageUrl && (
                            <div className="shrink-0 h-12 w-12 rounded-md overflow-hidden border bg-muted">
                              <Image src={pack.imageUrl} alt={pack.name} width={48} height={48} className="h-full w-full object-cover" unoptimized />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-[12px] truncate">{pack?.name || order.mlItemId}</p>
                            <p className="mono text-[10px] text-muted-foreground">{pack?.sku || order.mlItemId}</p>
                          </div>
                        </div>
                        <span className={PREP_CONFIG[order.prepStatus].css}>
                          {PREP_CONFIG[order.prepStatus].label}
                        </span>
                      </div>

                      {/* Order details */}
                      <div className="space-y-1.5 text-[11.5px]">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Cantidad</span>
                          <span className="font-semibold">{order.quantity} unidad{order.quantity > 1 ? "es" : ""}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Monto</span>
                          <span className="num font-medium">{formatCurrency(Number(order.totalAmount))}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Fecha</span>
                          <span>{formatDateTime(order.dateCreated)}</span>
                        </div>
                        {order.buyerNickname && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Comprador</span>
                            <span className="truncate ml-2">{order.buyerNickname}</span>
                          </div>
                        )}
                      </div>

                      {/* Pack contents — what to grab */}
                      {pack && pack.items.length > 0 && (
                        <div className="border-t pt-2 space-y-1">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Contenido del paquete</p>
                          {pack.items.map((item, idx) => {
                            const dotClass = (item.productVariant.color && ENUM_DOT[item.productVariant.color])
                              || (item.productVariant.variantLabel && LABEL_DOT[item.productVariant.variantLabel.split(" / ")[0]]);
                            const label = item.productVariant.variantLabel || item.productVariant.product.name;
                            const lowStock = item.productVariant.stock < item.quantity * order.quantity;
                            return (
                              <div key={idx} className="flex items-center justify-between text-[11px]">
                                <div className="flex items-center gap-1.5">
                                  {dotClass && <span className={`inline-block h-2.5 w-2.5 rounded-full ${dotClass}`} />}
                                  <span className={lowStock ? "text-red-600 font-medium" : ""}>{label}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono">×{item.quantity * order.quantity}</span>
                                  {lowStock && <span className="text-[9px] text-red-500 font-medium">SIN STOCK</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Stock alert */}
                      {order.stockAlert && (
                        <div className="rounded-md bg-red-50 dark:bg-red-950/20 p-2 text-[11px] text-red-600 dark:text-red-400 font-medium">
                          Stock agotado para este pack
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
