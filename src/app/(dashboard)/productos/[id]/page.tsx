export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { VariantStockGrid } from "@/components/products/variant-stock-grid";
import { ColorBadge } from "@/components/shared/color-badge";
import { formatCurrency, formatDateTime, getVariantDisplay } from "@/lib/utils";
import type { VariantWithStock } from "@/types";

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
        select: { id: true, color: true, variantLabel: true, stock: true, productId: true },
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
        productVariant: { select: { color: true, variantLabel: true } },
      },
    }),
    prisma.stockLog.findMany({
      where: { productVariantId: { in: variantIds } },
      take: 15,
      orderBy: { createdAt: "desc" },
      include: {
        productVariant: {
          select: { color: true, variantLabel: true, product: { select: { name: true, supplierCode: true } } },
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
        description={`Codigo: ${product.supplierCode} · Proveedor: ${product.supplier.name}${product.brand ? ` · Marca: ${product.brand}` : ""}`}
      />

      {/* Product info + Variant stock grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Info card */}
        <div className="rounded-[9px] border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
            <h3 className="text-[12.5px] font-semibold">Informacion del Producto</h3>
          </div>
          <div className="px-4 py-3 space-y-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[12.5px]">
              <span className="text-muted-foreground">Nombre</span>
              <span className="font-medium text-right">{product.name}</span>

              <span className="text-muted-foreground">Codigo</span>
              <span className="mono text-[11.5px] text-muted-foreground text-right">{product.supplierCode}</span>

              <span className="text-muted-foreground">Proveedor</span>
              <span className="font-medium text-right">{product.supplier.name}</span>

              {product.brand && (
                <>
                  <span className="text-muted-foreground">Marca</span>
                  <span className="font-medium text-right">{product.brand}</span>
                </>
              )}

              <span className="text-muted-foreground">Costo Unitario</span>
              <span className="font-medium text-right">
                {formatCurrency(product.unitCost.toString())}
              </span>

              <span className="text-muted-foreground">Stock Total</span>
              <span
                className={`font-semibold text-right ${
                  totalStock === 0
                    ? "text-destructive"
                    : totalStock <= 5
                      ? "text-[oklch(0.48_0.13_70)]"
                      : "text-success"
                }`}
              >
                {totalStock} uds
              </span>
            </div>
            {product.description && (
              <div className="border-t border-border pt-2.5">
                <span className="text-[11px] text-muted-foreground uppercase tracking-[0.05em]">
                  Descripcion
                </span>
                <p className="mt-1 text-[12.5px]">{product.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Variant stock grid */}
        <div className="lg:col-span-2">
          <VariantStockGrid variants={variants} />
        </div>
      </div>

      {/* Packs that use this product */}
      {packItems.length > 0 && (
        <div className="rounded-[9px] border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
            <h3 className="text-[12.5px] font-semibold">Packs que incluyen este producto</h3>
            <span className="text-[11px] text-muted-foreground">{packItems.length} items</span>
          </div>
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                  Pack
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                  SKU
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                  Variante
                </th>
                <th className="px-3 py-2.5 text-right text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                  Cantidad
                </th>
              </tr>
            </thead>
            <tbody>
              {packItems.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                  <td className="px-3 py-2.5 font-medium">
                    {item.pack.name}
                  </td>
                  <td className="px-3 py-2.5 mono text-[11.5px] text-muted-foreground">
                    {item.pack.sku}
                  </td>
                  <td className="px-3 py-2.5">
                    <ColorBadge
                      color={item.productVariant.color}
                      variantLabel={item.productVariant.variantLabel}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-right mono">
                    {item.quantity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent stock logs */}
      <div className="rounded-[9px] border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
          <h3 className="text-[12.5px] font-semibold">Movimientos Recientes de Stock</h3>
          {stockLogs.length > 0 && (
            <span className="text-[11px] text-muted-foreground">
              Ultimos {stockLogs.length}
            </span>
          )}
        </div>
        {stockLogs.length === 0 ? (
          <div className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">
            No hay movimientos de stock registrados para este producto.
          </div>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                  Variante
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                  Tipo
                </th>
                <th className="px-3 py-2.5 text-right text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                  Anterior
                </th>
                <th className="px-3 py-2.5 text-right text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                  Cambio
                </th>
                <th className="px-3 py-2.5 text-right text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                  Nuevo
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                  Razon
                </th>
                <th className="px-3 py-2.5 text-right text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                  Fecha
                </th>
              </tr>
            </thead>
            <tbody>
              {stockLogs.map((log) => (
                <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                  <td className="px-3 py-2.5">
                    <ColorBadge
                      color={log.productVariant.color}
                      variantLabel={log.productVariant.variantLabel}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {changeTypeLabels[log.changeType] || log.changeType}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums mono text-[11.5px] text-muted-foreground">
                    {log.previousStock}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span
                      className={`mono text-[12px] font-semibold ${
                        log.quantityChange > 0
                          ? "text-green-600 dark:text-green-400"
                          : "text-destructive"
                      }`}
                    >
                      {log.quantityChange > 0 ? "+" : ""}
                      {log.quantityChange}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right mono text-[12px] font-semibold">
                    {log.newStock}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground text-[11.5px] max-w-32 truncate">
                    {log.reason || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[11px] text-muted-foreground">
                    {formatDateTime(log.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
