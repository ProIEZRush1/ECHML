export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { ColorBadge } from "@/components/shared/color-badge";
import { formatDateTime } from "@/lib/utils";
import type { StockChangeType, Color } from "@/types";

const CHANGE_TYPE_LABELS: Record<StockChangeType, string> = {
  SALE: "Venta",
  MANUAL_ADD: "Entrada",
  MANUAL_REMOVE: "Salida",
  ADJUSTMENT: "Ajuste",
  INITIAL: "Inicial",
};

const CHANGE_TYPE_PILL: Record<StockChangeType, string> = {
  SALE: "fee",
  MANUAL_ADD: "sale",
  MANUAL_REMOVE: "shipping",
  ADJUSTMENT: "expense",
  INITIAL: "withdraw",
};

export default async function StockHistoryPage() {
  const logs = await prisma.stockLog.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    include: {
      productVariant: {
        include: {
          product: true,
        },
      },
      user: {
        select: { name: true },
      },
    },
  });

  return (
    <div>
      <PageHeader
        title="Historial de Stock"
        description="Registro de todos los movimientos de inventario"
      />

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">Fecha</th>
              <th className="text-left px-3 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">Producto</th>
              <th className="text-left px-3 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">Color</th>
              <th className="text-left px-3 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">Tipo</th>
              <th className="text-right px-3 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">Cantidad</th>
              <th className="text-right px-3 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">Anterior</th>
              <th className="text-right px-3 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">Nuevo</th>
              <th className="text-left px-3 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">Razon</th>
              <th className="text-left px-3 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">Usuario</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              const pillClass = CHANGE_TYPE_PILL[log.changeType as StockChangeType] || "withdraw";
              return (
                <tr key={log.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5 text-[12px] text-muted-foreground whitespace-nowrap">
                    {formatDateTime(log.createdAt)}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-[13px]">
                    {log.productVariant.product.name}
                  </td>
                  <td className="px-3 py-2.5">
                    <ColorBadge color={log.productVariant.color as Color} />
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`tx-pill ${pillClass}`}>
                      {CHANGE_TYPE_LABELS[log.changeType as StockChangeType]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={`mono font-semibold text-[13px] ${
                      log.quantityChange > 0
                        ? "text-[oklch(0.58_0.10_155)]"
                        : "text-[oklch(0.58_0.16_22)]"
                    }`}>
                      {log.quantityChange > 0 ? "+" : ""}{log.quantityChange}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right mono text-muted-foreground text-[12px]">
                    {log.previousStock}
                  </td>
                  <td className="px-3 py-2.5 text-right mono font-medium text-[13px]">
                    {log.newStock}
                  </td>
                  <td className="px-3 py-2.5 max-w-[200px] truncate text-[12px] text-muted-foreground">
                    {log.reason || "-"}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-muted-foreground">
                    {log.user?.name || "-"}
                  </td>
                </tr>
              );
            })}
            {logs.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-12 text-muted-foreground text-sm">
                  No hay movimientos registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
