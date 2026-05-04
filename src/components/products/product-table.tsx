"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StockIndicator } from "@/components/shared/stock-indicator";
import { ProductFormDialog } from "@/components/products/product-form-dialog";
import { ProductDeleteButton } from "@/components/products/product-delete-button";
import { formatCurrency } from "@/lib/utils";
import { Search, ArrowUpDown, Pencil } from "lucide-react";
import type { ProductWithVariants } from "@/types";
import type { Color } from "@prisma/client";

interface ProductTableProps {
  products: ProductWithVariants[];
}

type SortField = "name" | "totalStock";
type SortDirection = "asc" | "desc";

const COLORS: Color[] = ["AZUL", "VERDE", "ROSA", "MORADO"];
const COLOR_LABELS: Record<Color, string> = {
  AZUL: "Azul",
  VERDE: "Verde",
  ROSA: "Rosa",
  MORADO: "Morado",
};

export function ProductTable({ products }: ProductTableProps) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [editingProduct, setEditingProduct] = useState<ProductWithVariants | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filteredProducts = useMemo(() => {
    let result = products;

    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.supplierCode.toLowerCase().includes(term)
      );
    }

    result = [...result].sort((a, b) => {
      if (sortField === "name") {
        const cmp = a.name.localeCompare(b.name, "es");
        return sortDirection === "asc" ? cmp : -cmp;
      }

      const totalA = a.variants.reduce((sum, v) => sum + v.stock, 0);
      const totalB = b.variants.reduce((sum, v) => sum + v.stock, 0);
      return sortDirection === "asc" ? totalA - totalB : totalB - totalA;
    });

    return result;
  }, [products, search, sortField, sortDirection]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  }

  function getVariantStock(product: ProductWithVariants, color: Color): number | null {
    const variant = product.variants.find((v) => v.color === color);
    return variant ? variant.stock : null;
  }

  function handleEdit(product: ProductWithVariants) {
    setEditingProduct(product);
    setDialogOpen(true);
  }

  function handleDialogChange(open: boolean) {
    setDialogOpen(open);
    if (!open) setEditingProduct(null);
  }

  return (
    <>
      <Card>
        <CardContent className="pt-4">
          <div className="mb-4 flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o codigo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <span className="text-sm text-muted-foreground">
              {filteredProducts.length} producto{filteredProducts.length !== 1 ? "s" : ""}
            </span>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Codigo</TableHead>
                <TableHead>
                  <button
                    onClick={() => toggleSort("name")}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    Producto
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead>Costo</TableHead>
                {COLORS.map((color) => (
                  <TableHead key={color} className="text-center">
                    {COLOR_LABELS[color]}
                  </TableHead>
                ))}
                <TableHead>
                  <button
                    onClick={() => toggleSort("totalStock")}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    Stock Total
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4 + COLORS.length + 2} className="text-center py-8">
                    <p className="text-muted-foreground">No se encontraron productos</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product) => {
                  const totalStock = product.variants.reduce(
                    (sum, v) => sum + v.stock,
                    0
                  );

                  return (
                    <TableRow key={product.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {product.supplierCode}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/productos/${product.id}`}
                          className="font-medium hover:underline"
                        >
                          {product.name}
                        </Link>
                      </TableCell>
                      <TableCell>{formatCurrency(product.unitCost)}</TableCell>
                      {COLORS.map((color) => {
                        const stock = getVariantStock(product, color);
                        return (
                          <TableCell key={color} className="text-center">
                            {stock !== null ? (
                              <StockIndicator stock={stock} showBadge={false} />
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell>
                        <StockIndicator stock={totalStock} showBadge={false} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleEdit(product)}
                          >
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                          <ProductDeleteButton
                            productId={product.id}
                            productName={product.name}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={handleDialogChange}
        product={editingProduct}
      />
    </>
  );
}
