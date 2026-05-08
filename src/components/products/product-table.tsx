"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StockIndicator } from "@/components/shared/stock-indicator";
import { ProductFormDialog } from "@/components/products/product-form-dialog";
import { ProductDeleteButton } from "@/components/products/product-delete-button";
import { formatCurrency, getVariantDisplay, COLOR_MAP } from "@/lib/utils";
import { Search, ArrowUpDown, Pencil, Package } from "lucide-react";
import type { ProductWithVariants } from "@/types";
import type { Color } from "@prisma/client";

interface ProductTableProps {
  products: ProductWithVariants[];
}

type SortField = "name" | "totalStock";
type SortDirection = "asc" | "desc";

const STANDARD_COLORS: Color[] = ["AZUL", "VERDE", "ROSA", "MORADO"];

function hasStandardColors(product: ProductWithVariants): boolean {
  return (
    product.variants.length === 4 &&
    product.variants.every((v) => v.color && STANDARD_COLORS.includes(v.color))
  );
}

export function ProductTable({ products }: ProductTableProps) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [editingProduct, setEditingProduct] = useState<ProductWithVariants | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<{ url: string; name: string } | null>(null);

  const filteredProducts = useMemo(() => {
    let result = products;

    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.supplierCode.toLowerCase().includes(term) ||
          (p.brand && p.brand.toLowerCase().includes(term))
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

  const allStandard = useMemo(
    () => products.length > 0 && products.every(hasStandardColors),
    [products]
  );

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
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
      {/* Filter bar */}
      <div className="filt-bar">
        <span className="lbl">Buscar</span>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Nombre, codigo o marca..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-[12.5px]"
          />
        </div>
        <span className="text-[11px] text-muted-foreground ml-auto">
          {filteredProducts.length} producto{filteredProducts.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table card */}
      <div className="rounded-[9px] border border-border bg-card overflow-hidden">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                Codigo
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                <button
                  onClick={() => toggleSort("name")}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  Producto
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                Marca
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                Costo
              </th>
              {allStandard ? (
                STANDARD_COLORS.map((color) => (
                  <th key={color} className="px-3 py-2.5 text-center text-[11px] font-medium uppercase tracking-[0.05em]">
                    <span className={`flex items-center justify-center gap-1 ${COLOR_MAP[color].text}`}>
                      <span className={`inline-block size-2 rounded-full ${COLOR_MAP[color].bg}`} />
                      {COLOR_MAP[color].label}
                    </span>
                  </th>
                ))
              ) : (
                <th className="px-3 py-2.5 text-center text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                  Variantes
                </th>
              )}
              <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                <button
                  onClick={() => toggleSort("totalStock")}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  Stock Total
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-3 py-2.5 text-right text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={allStandard ? 9 : 8} className="text-center py-8 text-muted-foreground text-[12.5px]">
                  No se encontraron productos
                </td>
              </tr>
            ) : (
              filteredProducts.map((product) => {
                const totalStock = product.variants.reduce(
                  (sum, v) => sum + v.stock,
                  0
                );

                return (
                  <tr key={product.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-3 py-2.5 mono text-[11.5px] text-muted-foreground">
                      {product.supplierCode}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        {product.imageUrl ? (
                          <button
                            type="button"
                            onClick={() => setEnlargedImage({ url: product.imageUrl!, name: product.name })}
                            className="flex-shrink-0 cursor-zoom-in"
                          >
                            <Image
                              src={product.imageUrl}
                              alt={product.name}
                              width={40}
                              height={40}
                              className="size-10 rounded-md object-cover bg-muted"
                              unoptimized
                            />
                          </button>
                        ) : (
                          <div className="size-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                            <Package className="size-4 text-muted-foreground" />
                          </div>
                        )}
                        <Link
                          href={`/productos/${product.id}`}
                          className="font-medium hover:underline"
                        >
                          {product.name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {product.brand || "—"}
                    </td>
                    <td className="px-3 py-2.5">{formatCurrency(product.unitCost)}</td>
                    {allStandard ? (
                      STANDARD_COLORS.map((color) => {
                        const variant = product.variants.find((v) => v.color === color);
                        return (
                          <td key={color} className="px-3 py-2.5 text-center">
                            {variant ? (
                              <span
                                className={`mono text-[12px] font-semibold ${
                                  variant.stock === 0
                                    ? "text-destructive"
                                    : variant.stock <= 5
                                      ? "text-[oklch(0.48_0.13_70)]"
                                      : "text-success"
                                }`}
                              >
                                {variant.stock}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                        );
                      })
                    ) : (
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          {product.variants.map((variant) => {
                            const display = getVariantDisplay(variant);
                            return (
                              <Badge
                                key={variant.id}
                                variant="secondary"
                                className="text-[10.5px] gap-1"
                              >
                                <span
                                  className={`inline-block size-2 rounded-full ${display.bg}`}
                                />
                                {display.label}: {variant.stock}
                              </Badge>
                            );
                          })}
                        </div>
                      </td>
                    )}
                    <td className="px-3 py-2.5">
                      <span
                        className={`mono text-[12px] font-semibold ${
                          totalStock === 0
                            ? "text-destructive"
                            : totalStock <= 5
                              ? "text-[oklch(0.48_0.13_70)]"
                              : "text-success"
                        }`}
                      >
                        {totalStock}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEdit(product)}
                          className="size-7 flex items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <ProductDeleteButton
                          productId={product.id}
                          productName={product.name}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={handleDialogChange}
        product={editingProduct}
      />

      {enlargedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setEnlargedImage(null)}
        >
          <div className="relative max-w-md max-h-[80vh] p-2" onClick={(e) => e.stopPropagation()}>
            <Image
              src={enlargedImage.url}
              alt={enlargedImage.name}
              width={400}
              height={400}
              className="rounded-lg object-contain max-h-[75vh] w-auto"
              unoptimized
            />
            <p className="text-center text-white text-sm mt-2">{enlargedImage.name}</p>
            <button
              onClick={() => setEnlargedImage(null)}
              className="absolute -top-2 -right-2 size-8 rounded-full bg-white/90 text-black flex items-center justify-center text-lg font-bold hover:bg-white"
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </>
  );
}
