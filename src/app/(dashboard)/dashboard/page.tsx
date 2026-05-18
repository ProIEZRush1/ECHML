export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { StockAlerts } from "@/components/dashboard/stock-alerts";
import { ColorBadge } from "@/components/shared/color-badge";
import { formatDateTime } from "@/lib/utils";
import type { DashboardStats } from "@/types";
import type { ColorKey } from "@/lib/utils";

export default async function DashboardPage() {
  const [
    totalProducts,
    totalVariants,
    totalPacks,
    totalListings,
    stockValueResult,
    lowStockVariants,
    recentStockLogs,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.productVariant.count(),
    prisma.pack.count(),
    prisma.mLListing.count(),
    prisma.$queryRaw<[{ total: number }]>`
      SELECT COALESCE(SUM(pv.stock * p."unitCost"), 0)::float as total
      FROM "ProductVariant" pv
      JOIN "Product" p ON pv."productId" = p.id
    `,
    prisma.productVariant.findMany({
      where: { stock: { lte: 10 } },
      include: {
        product: { select: { name: true, supplierCode: true } },
      },
      orderBy: { stock: "asc" },
    }),
    prisma.stockLog.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        productVariant: {
          include: {
            product: { select: { name: true, supplierCode: true } },
          },
        },
        user: { select: { name: true } },
      },
    }),
  ]);

  const totalStockValue = stockValueResult[0]?.total ?? 0;
  const outOfStockCount = lowStockVariants.filter((v) => v.stock <= 0).length;

  const stats: DashboardStats = {
    totalProducts,
    totalVariants,
    totalPacks,
    totalListings,
    totalStockValue,
    lowStockAlerts: lowStockVariants.length,
    outOfStockAlerts: outOfStockCount,
  };

  const alerts = lowStockVariants.map((v) => ({
    productName: v.product.name,
    supplierCode: v.product.supplierCode,
    color: v.color as ColorKey,
    stock: v.stock,
  }));

  const changeTypeLabels: Record<string, string> = {
    SALE: "Venta",
    MANUAL_ADD: "Entrada manual",
    MANUAL_REMOVE: "Salida manual",
    ADJUSTMENT: "Ajuste",
    INITIAL: "Inicial",
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Inicio" description="Resumen general" />

      <KpiCards stats={stats} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <StockAlerts alerts={alerts} />

        <div className="rounded-[9px] border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
            <h3 className="text-[12.5px] font-semibold">Movimientos Recientes</h3>
            <span className="text-[11px] text-muted-foreground">
              Últimos {recentStockLogs.length}
            </span>
          </div>
          {recentStockLogs.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              No hay movimientos de stock registrados.
            </div>
          ) : (
            <div>
              {recentStockLogs.map((log) => (
                <div
                  key={log.id}
                  className="grid grid-cols-[1fr_auto_auto] gap-3 items-center px-4 py-2.5 border-b border-border last:border-0"
                >
                  <div>
                    <div className="text-[12.5px] font-medium flex items-center gap-1.5">
                      <ColorBadge color={log.productVariant.color as ColorKey} showLabel={false} />
                      {log.productVariant.product.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {changeTypeLabels[log.changeType] || log.changeType}
                    </div>
                  </div>
                  <div
                    className={`mono num text-[13px] font-semibold ${
                      log.quantityChange > 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-destructive"
                    }`}
                  >
                    {log.quantityChange > 0 ? "+" : ""}
                    {log.quantityChange}
                  </div>
                  <div className="text-[11px] text-muted-foreground min-w-[72px] text-right">
                    {formatDateTime(log.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
