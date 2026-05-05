export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { ProductTable } from "@/components/products/product-table";
import { ProductCreateButton } from "@/components/products/product-create-button";
import type { ProductWithVariants } from "@/types";

export default async function ProductosPage() {
  const products = await prisma.product.findMany({
    include: {
      supplier: { select: { id: true, name: true } },
      variants: {
        select: { id: true, color: true, variantLabel: true, stock: true, productId: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const typedProducts: ProductWithVariants[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    supplierCode: p.supplierCode,
    unitCost: p.unitCost.toString(),
    brand: p.brand,
    description: p.description,
    imageUrl: p.imageUrl,
    supplier: p.supplier,
    variants: p.variants,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Productos"
        description="Gestion de productos y variantes de inventario"
      >
        <ProductCreateButton />
      </PageHeader>

      <ProductTable products={typedProducts} />
    </div>
  );
}
