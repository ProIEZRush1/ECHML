export const dynamic = "force-dynamic";

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
import { getStockColor, getVariantDisplay } from "@/lib/utils";

export default async function StockPage() {
  const products = await prisma.product.findMany({
    include: {
      variants: {
        select: { id: true, color: true, variantLabel: true, stock: true },
        orderBy: { color: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  // Collect all unique variant labels/colors across products
  const allVariantKeys: string[] = [];
  for (const product of products) {
    for (const v of product.variants) {
      const display = getVariantDisplay(v);
      if (!allVariantKeys.includes(display.label)) {
        allVariantKeys.push(display.label);
      }
    }
  }

  let grandTotal = 0;
  const columnTotals: Record<string, number> = {};
  for (const key of allVariantKeys) {
    columnTotals[key] = 0;
  }

  const rows = products.map((product) => {
    const stockByKey: Record<string, number> = {};
    let rowTotal = 0;

    for (const variant of product.variants) {
      const display = getVariantDisplay(variant);
      stockByKey[display.label] = (stockByKey[display.label] || 0) + variant.stock;
      columnTotals[display.label] = (columnTotals[display.label] || 0) + variant.stock;
      rowTotal += variant.stock;
      grandTotal += variant.stock;
    }

    return { product, stockByKey, rowTotal };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventario"
        description="Vista general del stock por producto y variante"
      />

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Codigo</TableHead>
              {allVariantKeys.map((key) => (
                <TableHead key={key} className="text-center">
                  {key}
                </TableHead>
              ))}
              <TableHead className="text-center font-bold">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ product, stockByKey, rowTotal }) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell className="text-muted-foreground">{product.supplierCode}</TableCell>
                {allVariantKeys.map((key) => {
                  const stock = stockByKey[key] ?? 0;
                  const hasVariant = key in stockByKey;
                  return (
                    <TableCell key={key} className="text-center">
                      {hasVariant ? (
                        <span className={`font-medium ${getStockColor(stock)}`}>
                          {stock}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center font-bold">{rowTotal}</TableCell>
              </TableRow>
            ))}
            {/* Summary row */}
            <TableRow className="bg-muted/50 font-bold">
              <TableCell colSpan={2}>Total</TableCell>
              {allVariantKeys.map((key) => (
                <TableCell key={key} className="text-center">
                  {columnTotals[key]}
                </TableCell>
              ))}
              <TableCell className="text-center">{grandTotal}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
