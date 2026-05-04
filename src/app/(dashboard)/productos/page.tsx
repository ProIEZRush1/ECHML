import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { ProductTable } from "@/components/products/product-table";
import type { ProductWithVariants } from "@/types";

export default async function ProductosPage() {
  const products = await prisma.product.findMany({
    include: {
      supplier: { select: { id: true, name: true } },
      variants: {
        select: { id: true, color: true, stock: true, productId: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const typedProducts: ProductWithVariants[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    supplierCode: p.supplierCode,
    unitCost: p.unitCost.toString(),
    description: p.description,
    imageUrl: p.imageUrl,
    supplier: p.supplier,
    variants: p.variants,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Productos"
        description="Gestión de productos y variantes de inventario"
      />

      <ProductTable products={typedProducts} />
    </div>
  );
}
