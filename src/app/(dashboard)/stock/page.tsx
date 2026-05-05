export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { getVariantDisplay, getStockStatus } from "@/lib/utils";
import { StockGrid } from "./stock-grid";

export interface StockProduct {
  id: string;
  name: string;
  supplierCode: string;
  brand: string | null;
  totalStock: number;
  variants: {
    id: string;
    label: string;
    hex: string;
    stock: number;
  }[];
  status: "healthy" | "low" | "out";
}

export default async function StockPage() {
  const [products, groups, packs] = await Promise.all([
    prisma.product.findMany({
      include: {
        variants: {
          select: { id: true, color: true, variantLabel: true, stock: true },
          orderBy: { color: "asc" },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.productGroup.findMany({
      include: { items: { select: { productId: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.pack.findMany({
      select: {
        id: true,
        sku: true,
        name: true,
        items: { select: { productVariant: { select: { productId: true } } } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  // Transform data for client component
  const stockProducts: StockProduct[] = products.map((product) => {
    let totalStock = 0;
    const variants = product.variants.map((v) => {
      const display = getVariantDisplay(v);
      totalStock += v.stock;
      return {
        id: v.id,
        label: display.label,
        hex: display.hex,
        stock: v.stock,
      };
    });

    return {
      id: product.id,
      name: product.name,
      supplierCode: product.supplierCode,
      brand: product.brand,
      totalStock,
      variants,
      status: getStockStatus(totalStock),
    };
  });

  // Collect unique brands
  const brands = [...new Set(products.map((p) => p.brand).filter(Boolean))] as string[];

  // Transform groups
  const stockGroups = groups.map((g) => ({
    id: g.id,
    name: g.name,
    color: g.color,
    productIds: g.items.map((i) => i.productId),
  }));

  // Transform packs (unique product IDs per pack)
  const stockPacks = packs.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    productIds: [...new Set(p.items.map((i) => i.productVariant.productId))],
  }));

  // Summary stats
  const totalProducts = products.length;
  const totalVariants = products.reduce((sum, p) => sum + p.variants.length, 0);
  const totalUnits = stockProducts.reduce((sum, p) => sum + p.totalStock, 0);
  const lowStockAlerts = stockProducts.filter((p) => p.status === "low" || p.status === "out").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventario"
        description="Vista general del stock por producto y variante"
      />

      <StockGrid
        products={stockProducts}
        brands={brands}
        groups={stockGroups}
        packs={stockPacks}
        totalProducts={totalProducts}
        totalVariants={totalVariants}
        totalUnits={totalUnits}
        lowStockAlerts={lowStockAlerts}
      />
    </div>
  );
}
