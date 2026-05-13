export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Truck } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
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
  { label: "Devoluciones", value: "RETURNED" },
  { label: "No Entregado", value: "NOT_DELIVERED" },
  { label: "Pendientes", value: "PENDING" },
  { label: "Cancelados", value: "CANCELLED" },
];

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page || "1", 10));
  const pageSize = 50;
  const statusFilter = params.status as ShippingStatus | undefined;

  const where: { shippingStatus?: ShippingStatus } = {};
  if (statusFilter) where.shippingStatus = statusFilter;

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
      <div className="flex items-center justify-between">
        <PageHeader
          title="Pedidos"
          description="Estado de envio y devoluciones"
        />
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
      <div className="filt-bar">
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

      {/* Results info */}
      <div className="flex items-center justify-between text-[12px] text-muted-foreground">
        <span>{totalCount} pedidos{statusFilter ? " (filtrado)" : ""}</span>
        {totalPages > 1 && <span>Pagina {currentPage} de {totalPages}</span>}
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="Sin pedidos"
          description="Sincroniza ordenes desde Flujo de Caja y luego actualiza estados aqui."
        />
      ) : (
        <div className="rounded-[9px] border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[90px] text-[11px] uppercase tracking-wider">Fecha</TableHead>
                  <TableHead className="w-[110px] text-[11px] uppercase tracking-wider">Orden ML</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Item ML</TableHead>
                  <TableHead className="w-[50px] text-center text-[11px] uppercase tracking-wider">Cant</TableHead>
                  <TableHead className="w-[100px] text-right text-[11px] uppercase tracking-wider">Monto</TableHead>
                  <TableHead className="w-[80px] text-[11px] uppercase tracking-wider">Comprador</TableHead>
                  <TableHead className="w-[100px] text-[11px] uppercase tracking-wider">Estado Envio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const config = STATUS_CONFIG[order.shippingStatus];
                  return (
                    <TableRow key={order.id} className="hover:bg-muted/50">
                      <TableCell className="text-[12.5px] text-muted-foreground whitespace-nowrap">
                        {formatDate(order.dateCreated)}
                      </TableCell>
                      <TableCell className="text-[11px] font-mono text-muted-foreground">
                        {String(order.mlOrderId)}
                      </TableCell>
                      <TableCell className="text-[11.5px] font-mono text-muted-foreground">
                        {order.mlItemId}
                      </TableCell>
                      <TableCell className="text-center num text-[12.5px]">
                        {order.quantity}
                      </TableCell>
                      <TableCell className="text-right num text-[12.5px] font-semibold">
                        {formatCurrency(Number(order.totalAmount))}
                      </TableCell>
                      <TableCell className="text-[11.5px] text-muted-foreground truncate max-w-[100px]">
                        {order.buyerNickname || "-"}
                      </TableCell>
                      <TableCell>
                        <span className={config.css}>{config.label}</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {currentPage > 1 && (
            <Link href={buildPageUrl(currentPage - 1)} className="filt-input hover:border-muted-foreground">
              Anterior
            </Link>
          )}
          {currentPage < totalPages && (
            <Link href={buildPageUrl(currentPage + 1)} className="filt-input hover:border-muted-foreground">
              Siguiente
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
