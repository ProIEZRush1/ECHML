import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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

const CHANGE_TYPE_STYLES: Record<StockChangeType, string> = {
  SALE: "bg-red-100 text-red-800",
  MANUAL_ADD: "bg-green-100 text-green-800",
  MANUAL_REMOVE: "bg-orange-100 text-orange-800",
  ADJUSTMENT: "bg-blue-100 text-blue-800",
  INITIAL: "bg-gray-100 text-gray-800",
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
    <div className="space-y-6">
      <PageHeader
        title="Historial de Stock"
        description="Registro de todos los movimientos de inventario"
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Color</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">Stock Anterior</TableHead>
              <TableHead className="text-right">Stock Nuevo</TableHead>
              <TableHead>Razon</TableHead>
              <TableHead>Usuario</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {formatDateTime(log.createdAt)}
                </TableCell>
                <TableCell className="font-medium">
                  {log.productVariant.product.name}
                </TableCell>
                <TableCell>
                  <ColorBadge color={log.productVariant.color as Color} />
                </TableCell>
                <TableCell>
                  <Badge className={CHANGE_TYPE_STYLES[log.changeType as StockChangeType]}>
                    {CHANGE_TYPE_LABELS[log.changeType as StockChangeType]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono">
                  <span className={log.quantityChange > 0 ? "text-green-600" : "text-red-600"}>
                    {log.quantityChange > 0 ? "+" : ""}{log.quantityChange}
                  </span>
                </TableCell>
                <TableCell className="text-right">{log.previousStock}</TableCell>
                <TableCell className="text-right font-medium">{log.newStock}</TableCell>
                <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                  {log.reason || "-"}
                </TableCell>
                <TableCell className="text-sm">
                  {log.user?.name || "-"}
                </TableCell>
              </TableRow>
            ))}
            {logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No hay movimientos registrados
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
