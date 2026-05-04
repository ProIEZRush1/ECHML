export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { VariantStockGrid } from "@/components/products/variant-stock-grid";
import { ColorBadge } from "@/components/shared/color-badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDateTime, type ColorKey } from "@/lib/utils";
import type { VariantWithStock } from "@/types";
import { Package, Boxes, Clock } from "lucide-react";

interface ProductDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, name: true } },
      variants: {
        select: { id: true, color: true, stock: true, productId: true },
        orderBy: { color: "asc" },
      },
    },
  });

  if (!product) notFound();

  const variantIds = product.variants.map((v) => v.id);

  const [packItems, stockLogs] = await Promise.all([
    prisma.packItem.findMany({
      where: { productVariantId: { in: variantIds } },
      include: {
        pack: { select: { id: true, name: true, sku: true } },
        productVariant: { select: { color: true } },
      },
    }),
    prisma.stockLog.findMany({
      where: { productVariantId: { in: variantIds } },
      take: 15,
      orderBy: { createdAt: "desc" },
      include: {
        productVariant: {
          select: { color: true, product: { select: { name: true, supplierCode: true } } },
        },
        user: { select: { name: true } },
      },
    }),
  ]);

  const variants: VariantWithStock[] = product.variants;
  const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);

  const changeTypeLabels: Record<string, string> = {
    SALE: "Venta",
    MANUAL_ADD: "Entrada manual",
    MANUAL_REMOVE: "Salida manual",
    ADJUSTMENT: "Ajuste",
    INITIAL: "Inicial",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={product.name}
        description={`Código: ${product.supplierCode} · Proveedor: ${product.supplier.name}`}
      />

      {/* Product info card */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4" />
              Información del Producto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Nombre</span>
              <span className="text-sm font-medium">{product.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Código</span>
              <span className="text-sm font-mono">{product.supplierCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Proveedor</span>
              <span className="text-sm font-medium">{product.supplier.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Costo Unitario</span>
              <span className="text-sm font-medium">
                {formatCurrency(product.unitCost.toString())}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Stock Total</span>
              <span className="text-sm font-bold">{totalStock} unidades</span>
            </div>
            {product.description && (
              <div className="pt-2 border-t">
                <span className="text-sm text-muted-foreground">Descripción</span>
                <p className="mt-1 text-sm">{product.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Variant stock grid */}
        <div className="lg:col-span-2">
          <VariantStockGrid variants={variants} />
        </div>
      </div>

      {/* Packs that use this product */}
      {packItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Boxes className="h-4 w-4" />
              Packs que incluyen este producto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pack</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Color de Variante</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.pack.name}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {item.pack.sku}
                    </TableCell>
                    <TableCell>
                      <ColorBadge color={item.productVariant.color as ColorKey} />
                    </TableCell>
                    <TableCell className="text-right">
                      {item.quantity}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recent stock logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Movimientos Recientes de Stock
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stockLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay movimientos de stock registrados para este producto.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Color</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Anterior</TableHead>
                  <TableHead className="text-right">Cambio</TableHead>
                  <TableHead className="text-right">Nuevo</TableHead>
                  <TableHead>Razón</TableHead>
                  <TableHead className="text-right">Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <ColorBadge color={log.productVariant.color as ColorKey} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {changeTypeLabels[log.changeType] || log.changeType}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {log.previousStock}
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
                    <TableCell className="text-right tabular-nums font-medium">
                      {log.newStock}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs max-w-32 truncate">
                      {log.reason || "—"}
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
  );
}
