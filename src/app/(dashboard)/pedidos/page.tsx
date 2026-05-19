export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Truck } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import type { ShippingStatus } from "@prisma/client";
import { SyncStatusButton } from "./sync-status-button";

const STATUS_CONFIG: Record<ShippingStatus, { label: string; css: string }> = {
  PENDING: { label: "Pendiente", css: "tx-pill expense" },
  READY_TO_SHIP: { label: "Listo", css: "tx-pill flex" },
  SHIPPED: { label: "En Camino", css: "tx-pill shipping" },
  DELIVERED: { label: "Entregado", css: "tx-pill sale" },
  NOT_DELIVERED: { label: "No Entregado", css: "tx-pill fee" },
  RETURNED: { label: "Devolucion", css: "tx-pill fee" },
  CANCELLED: { label: "Cancelado", css: "tx-pill expense" },
};

const FILTER_TABS: { label: string; value: string }[] = [
  { label: "Todos", value: "" },
  { label: "En Camino", value: "SHIPPED" },
  { label: "Entregados", value: "DELIVERED" },
  { label: "Devoluciones", value: "DEVOLUCIONES" },
  { label: "Pendientes", value: "PENDING" },
  { label: "Cancelados", value: "CANCELLED" },
];

const VARIANT_DOT: Record<string, string> = {
  AZUL: "bg-blue-500", VERDE: "bg-green-500", ROSA: "bg-pink-400", MORADO: "bg-purple-500",
};
const LABEL_DOT: Record<string, string> = {
  "Blanco": "bg-white border border-gray-300", "Negro": "bg-black", "Gris": "bg-gray-400",
  "Multicolor": "bg-gradient-to-r from-blue-500 via-green-500 to-pink-500",
  "Azul": "bg-blue-500", "Verde": "bg-green-500", "Rosa": "bg-pink-400", "Morado": "bg-purple-500",
};

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page || "1", 10));
  const pageSize = 50;
  const statusFilter = params.status || "";

  const where: { shippingStatus?: ShippingStatus | { in: ShippingStatus[] } } = {};
  if (statusFilter === "DEVOLUCIONES") {
    where.shippingStatus = { in: ["RETURNED", "NOT_DELIVERED"] };
  } else if (statusFilter) {
    where.shippingStatus = statusFilter as ShippingStatus;
  }

  const [orders, totalCount, statusCounts] = await Promise.all([
    prisma.mLOrder.findMany({
      where,
      orderBy: { dateCreated: "desc" },
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
    }),
    prisma.mLOrder.count({ where }),
    prisma.mLOrder.groupBy({
      by: ["shippingStatus"],
      _count: true,
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
          id: true, sku: true, name: true, imageUrl: true,
          items: {
            select: {
              quantity: true,
              productVariant: { select: { color: true, variantLabel: true } },
            },
          },
        },
      },
    },
  });
  const listingMap = new Map(listings.map((l) => [l.mlItemId, l]));

  const totalPages = Math.ceil(totalCount / pageSize);
  const totalOrders = statusCounts.reduce((s, c) => s + c._count, 0);
  const deliveredCount = statusCounts.find((c) => c.shippingStatus === "DELIVERED")?._count ?? 0;
  const shippedCount = statusCounts.find((c) => c.shippingStatus === "SHIPPED")?._count ?? 0;
  const returnedCount = statusCounts.find((c) => c.shippingStatus === "RETURNED")?._count ?? 0;
  const notDeliveredCount = statusCounts.find((c) => c.shippingStatus === "NOT_DELIVERED")?._count ?? 0;

  function buildPageUrl(page: number) {
    const p = new URLSearchParams();
    if (statusFilter) p.set("status", statusFilter);
    if (page > 1) p.set("page", String(page));
    const qs = p.toString();
    return `/pedidos${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PageHeader title="Pedidos" description="Estado de envio y devoluciones" />
        <SyncStatusButton />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-[9px] border border-border bg-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Total Pedidos</p>
          <p className="text-2xl font-bold mt-1 num">{totalOrders}</p>
        </div>
        <div className="rounded-[9px] border border-border bg-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Entregados</p>
          <p className="text-2xl font-bold mt-1 num margin-good">{deliveredCount}</p>
        </div>
        <div className="rounded-[9px] border border-border bg-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">En Camino</p>
          <p className="text-2xl font-bold mt-1 num margin-warn">{shippedCount}</p>
        </div>
        <div className="rounded-[9px] border border-border bg-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Devoluciones</p>
          <p className="text-2xl font-bold mt-1 num margin-bad">{returnedCount + notDeliveredCount}</p>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="filt-bar overflow-x-auto">
        <span className="lbl">Estado</span>
        {FILTER_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={tab.value ? `/pedidos?status=${tab.value}` : "/pedidos"}
            className={`filt-input ${(statusFilter || "") === tab.value ? "active" : ""}`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Devoluciones summary — per-return breakdown */}
      {statusFilter === "DEVOLUCIONES" && orders.length > 0 && (() => {
        const totalMonto = orders.reduce((s, o) => s + Number(o.totalAmount), 0);
        const fullCount = orders.filter((o) => o.logisticType === "fulfillment").length;
        const flexCount = orders.filter((o) => o.logisticType !== "fulfillment").length;
        return (
          <div className="rounded-[9px] border border-red-200 dark:border-red-900/30 bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Resumen Devoluciones</p>
                <p className="text-[11px] text-muted-foreground">{totalCount} total · {fullCount} Full · {flexCount} Flex/ME2 · ML reembolsa comisiones</p>
              </div>
              <p className="text-xl font-bold num margin-bad">-{formatCurrency(totalMonto)}</p>
            </div>
            <div className="divide-y divide-border">
              {orders.map((order) => {
                const listing = listingMap.get(order.mlItemId);
                const logistic = order.logisticType === "fulfillment" ? "FULL" : order.logisticType === "self_service" ? "FLEX" : "ME2";
                const logisticCss = order.logisticType === "fulfillment"
                  ? "text-[9px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400"
                  : order.logisticType === "self_service"
                  ? "text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                  : "text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400";
                return (
                  <div key={order.id} className="flex items-center gap-3 py-2 first:pt-0">
                    {listing?.pack?.imageUrl && (
                      <Image src={listing.pack.imageUrl} alt="" width={32} height={32} className="h-8 w-8 rounded object-cover shrink-0 border bg-muted" unoptimized />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] truncate">{listing?.title || order.mlItemId}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                        <span>{formatDateTime(order.dateCreated)}</span>
                        <span className={logisticCss}>{logistic}</span>
                        {order.buyerNickname && <span className="truncate">{order.buyerNickname}</span>}
                      </div>
                    </div>
                    <p className="text-[13px] font-bold num margin-bad shrink-0">-{formatCurrency(Number(order.totalAmount))}</p>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      <div className="flex items-center justify-between text-[12px] text-muted-foreground">
        <span>{totalCount} pedidos{statusFilter ? " (filtrado)" : ""}</span>
        {totalPages > 1 && <span>Pagina {currentPage} de {totalPages}</span>}
      </div>

      {orders.length === 0 ? (
        <EmptyState icon={Truck} title="Sin pedidos" description="Sincroniza ordenes desde Flujo de Caja y luego actualiza estados aqui." />
      ) : (
        <div className="rounded-[9px] border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[100px] text-[11px] uppercase tracking-wider">Fecha</TableHead>
                  <TableHead className="w-[44px] text-[11px] uppercase tracking-wider"></TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Producto</TableHead>
                  <TableHead className="w-[50px] text-center text-[11px] uppercase tracking-wider">Cant</TableHead>
                  <TableHead className="w-[90px] text-right text-[11px] uppercase tracking-wider">Monto</TableHead>
                  <TableHead className="w-[50px] text-[11px] uppercase tracking-wider">Envio</TableHead>
                  <TableHead className="w-[90px] text-[11px] uppercase tracking-wider">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const config = STATUS_CONFIG[order.shippingStatus];
                  const listing = listingMap.get(order.mlItemId);
                  const pack = listing?.pack;
                  return (
                    <TableRow key={order.id} className="hover:bg-muted/50">
                      <TableCell className="text-[12px] text-muted-foreground whitespace-nowrap">
                        {formatDateTime(order.dateCreated)}
                      </TableCell>
                      <TableCell className="px-1">
                        {pack?.imageUrl ? (
                          <div className="shrink-0 h-8 w-8 rounded overflow-hidden border bg-muted">
                            <Image src={pack.imageUrl} alt={pack.name} width={32} height={32} className="h-full w-full object-cover" unoptimized />
                          </div>
                        ) : (
                          <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                            <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="block truncate text-[12.5px] max-w-[280px]" title={listing?.title || order.mlItemId}>
                          {listing?.title || order.mlItemId}
                        </span>
                        {pack && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="mono text-[10.5px] text-muted-foreground">{pack.sku}</span>
                            {pack.items.length > 0 && pack.items.map((item, idx) => {
                              const dotClass = (item.productVariant.color && VARIANT_DOT[item.productVariant.color])
                                || (item.productVariant.variantLabel && LABEL_DOT[item.productVariant.variantLabel.split(" / ")[0]]);
                              return dotClass ? (
                                <span key={idx} className={`inline-block h-2 w-2 rounded-full shrink-0 ${dotClass}`} title={item.productVariant.variantLabel || ""} />
                              ) : null;
                            })}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center num text-[12.5px]">{order.quantity}</TableCell>
                      <TableCell className="text-right num text-[12.5px] font-semibold">{formatCurrency(Number(order.totalAmount))}</TableCell>
                      <TableCell>
                        {order.logisticType === "fulfillment" ? (
                          <span className="inline-flex items-center text-[9px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400">FULL</span>
                        ) : order.logisticType === "self_service" ? (
                          <span className="inline-flex items-center text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">FLEX</span>
                        ) : order.logisticType === "xd_drop_off" ? (
                          <span className="inline-flex items-center text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">ME2</span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell><span className={config.css}>{config.label}</span></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {currentPage > 1 && (
            <Link href={buildPageUrl(currentPage - 1)} className="filt-input hover:border-muted-foreground">Anterior</Link>
          )}
          {currentPage < totalPages && (
            <Link href={buildPageUrl(currentPage + 1)} className="filt-input hover:border-muted-foreground">Siguiente</Link>
          )}
        </div>
      )}
    </div>
  );
}
