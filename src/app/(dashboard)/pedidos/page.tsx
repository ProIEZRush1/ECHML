export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Truck, ExternalLink } from "lucide-react";
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

  // Fetch claim details + shipment base_cost for exact return shipping cost
  const returnShipInfoMap = new Map<bigint, { covered: boolean; cost: number; title: string; problem: string | null }>();
  if (statusFilter === "DEVOLUCIONES" && orders.length > 0) {
    try {
      const { mlFetch } = await import("@/lib/ml/client");
      const claimsData = await mlFetch<{ data: Array<{ id: number; resource_id: number }> }>(
        `/post-purchase/v1/claims/search`,
        { params: { status: "opened", role: "defendant", limit: "50" } }
      );
      for (const claim of claimsData.data || []) {
        const order = orders.find((o) => String(o.mlOrderId) === String(claim.resource_id));
        if (order) {
          try {
            const detail = await mlFetch<{ title?: string; problem?: string }>(`/post-purchase/v1/claims/${claim.id}/detail`);
            const title = detail.title || "";
            const covered = title.toLowerCase().includes("sin costo");
            let cost = 0;
            if (!covered && order.shipmentId) {
              try {
                const shipment = await mlFetch<{ base_cost?: number }>(`/shipments/${order.shipmentId}`);
                cost = shipment.base_cost || 0;
              } catch { /* skip */ }
            }
            returnShipInfoMap.set(order.mlOrderId, { covered, cost, title, problem: detail.problem || null });
          } catch { /* skip */ }
        }
      }
    } catch { /* claims API not available */ }
  }
  const returnShipCostMap = new Map<bigint, number>();

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
        const totalShipCost = orders.reduce((s, o) => s + (returnShipCostMap.get(o.mlOrderId) || 0), 0);
        const fullCount = orders.filter((o) => o.logisticType === "fulfillment").length;
        const flexCount = orders.filter((o) => o.logisticType !== "fulfillment").length;
        return (
          <div className="rounded-[9px] border border-red-200 dark:border-red-900/30 bg-card p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Resumen Devoluciones</p>
                <p className="text-[11px] text-muted-foreground">{totalCount} total · {fullCount} Full · {flexCount} Flex/ME2 · ML reembolsa comisiones</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold num margin-bad">-{formatCurrency(totalMonto)}</p>
                {(() => {
                  const totalReturnShip = orders.reduce((s, o) => s + (returnShipInfoMap.get(o.mlOrderId)?.cost || 0), 0);
                  const coveredCount = orders.filter((o) => returnShipInfoMap.get(o.mlOrderId)?.covered).length;
                  return (
                    <p className="text-[11px] text-muted-foreground">
                      {totalReturnShip > 0 && <span className="margin-bad">Envio devoluciones: -{formatCurrency(totalReturnShip)}</span>}
                      {totalReturnShip > 0 && coveredCount > 0 && " · "}
                      {coveredCount > 0 && <span className="text-green-600 dark:text-green-400">{coveredCount} cubiertos por ML</span>}
                    </p>
                  );
                })()}
              </div>
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
                const shipCost = returnShipCostMap.get(order.mlOrderId) || 0;
                return (
                  <div key={order.id} className="py-2.5 first:pt-0 space-y-1">
                    <div className="flex items-center gap-3">
                      {listing?.pack?.imageUrl && (
                        <Image src={listing.pack.imageUrl} alt="" width={32} height={32} className="h-8 w-8 rounded object-cover shrink-0 border bg-muted" unoptimized />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] truncate font-medium">{listing?.title || order.mlItemId}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                          <span>{formatDateTime(order.dateCreated)}</span>
                          <span className={logisticCss}>{logistic}</span>
                          {order.buyerNickname && <span className="truncate">{order.buyerNickname}</span>}
                        </div>
                      </div>
                      <a
                        href={`https://www.mercadolibre.com.mx/ventas/${order.mlOrderId}/detalle`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
                        title="Ver en MercadoLibre"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                    <div className="ml-11 grid grid-cols-2 gap-x-4 text-[11px]">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Reembolso</span>
                        <span className="num margin-bad">-{formatCurrency(Number(order.totalAmount))}</span>
                      </div>
                      {(() => {
                        const info = returnShipInfoMap.get(order.mlOrderId);
                        return (
                          <>
                            <div className="flex justify-between text-muted-foreground">
                              <span>Envio devolucion</span>
                              {info?.covered ? (
                                <span className="text-[10px] text-green-600 dark:text-green-400">$0 (ML cubre)</span>
                              ) : info?.cost ? (
                                <span className="num margin-bad">-{formatCurrency(info.cost)}</span>
                              ) : (
                                <span className="text-[10px]">Pendiente</span>
                              )}
                            </div>
                            {info?.problem && (
                              <div className="flex justify-between text-muted-foreground mt-0.5">
                                <span>Razon</span>
                                <span className="text-[10px] truncate ml-4">{info.problem}</span>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
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
                  <TableHead className="w-[32px]"></TableHead>
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
                      <TableCell className="text-right">
                        <a
                          href={`https://www.mercadolibre.com.mx/ventas/${order.mlOrderId}/detalle`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                          title="Ver en ML"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </TableCell>
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
