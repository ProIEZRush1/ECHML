export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { StockAlerts } from "@/components/dashboard/stock-alerts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ColorBadge } from "@/components/shared/color-badge";
import { formatDateTime } from "@/lib/utils";
import type { DashboardStats } from "@/types";
import type { ColorKey } from "@/lib/utils";
import { Clock } from "lucide-react";

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
      <PageHeader title="Panel de Control" description="Resumen general del inventario" />

      <KpiCards stats={stats} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <StockAlerts alerts={alerts} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Movimientos Recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentStockLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay movimientos de stock registrados.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Cambio</TableHead>
                    <TableHead className="text-right">Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentStockLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">
                        {log.productVariant.product.name}
                      </TableCell>
                      <TableCell>
                        <ColorBadge color={log.productVariant.color as ColorKey} showLabel={false} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {changeTypeLabels[log.changeType] || log.changeType}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            log.quantityChange > 0
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }
                        >
                          {log.quantityChange > 0 ? "+" : ""}
                          {log.quantityChange}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {formatDateTime(log.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
