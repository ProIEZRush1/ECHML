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
import { COLOR_MAP, getStockColor } from "@/lib/utils";
import type { Color } from "@/types";

const COLORS: Color[] = ["AZUL", "VERDE", "ROSA", "MORADO"];

export default async function StockPage() {
  const products = await prisma.product.findMany({
    include: {
      variants: {
        orderBy: { color: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const totals: Record<Color, number> = { AZUL: 0, VERDE: 0, ROSA: 0, MORADO: 0 };
  let grandTotal = 0;

  const rows = products.map((product) => {
    const stockByColor: Record<Color, number> = { AZUL: 0, VERDE: 0, ROSA: 0, MORADO: 0 };
    let rowTotal = 0;

    for (const variant of product.variants) {
      stockByColor[variant.color] = variant.stock;
      totals[variant.color] += variant.stock;
      rowTotal += variant.stock;
      grandTotal += variant.stock;
    }

    return { product, stockByColor, rowTotal };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventario"
        description="Vista general del stock por producto y color"
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Codigo</TableHead>
              {COLORS.map((color) => (
                <TableHead key={color} className="text-center">
                  <span className={`flex items-center justify-center gap-1.5 ${COLOR_MAP[color].text}`}>
                    <span className={`inline-block size-2.5 rounded-full ${COLOR_MAP[color].bg}`} />
                    {COLOR_MAP[color].label}
                  </span>
                </TableHead>
              ))}
              <TableHead className="text-center font-bold">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ product, stockByColor, rowTotal }) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell className="text-muted-foreground">{product.supplierCode}</TableCell>
                {COLORS.map((color) => (
                  <TableCell key={color} className="text-center">
                    <span className={`font-medium ${getStockColor(stockByColor[color])}`}>
                      {stockByColor[color]}
                    </span>
                  </TableCell>
                ))}
                <TableCell className="text-center font-bold">{rowTotal}</TableCell>
              </TableRow>
            ))}
            {/* Summary row */}
            <TableRow className="bg-muted/50 font-bold">
              <TableCell colSpan={2}>Total</TableCell>
              {COLORS.map((color) => (
                <TableCell key={color} className="text-center">
                  <span className={COLOR_MAP[color].text}>{totals[color]}</span>
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
