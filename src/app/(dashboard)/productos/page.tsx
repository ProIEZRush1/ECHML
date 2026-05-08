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
        select: {
          id: true,
          color: true,
          variantLabel: true,
          stock: true,
          productId: true,
          packItems: {
            select: {
              pack: { select: { imageUrl: true } },
            },
            take: 1,
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const typedProducts: ProductWithVariants[] = products.map((p) => {
    // Resolve image: product.imageUrl first, then first pack imageUrl
    let resolvedImageUrl = p.imageUrl;
    if (!resolvedImageUrl) {
      for (const v of p.variants) {
        const packImg = v.packItems?.[0]?.pack?.imageUrl;
        if (packImg) {
          resolvedImageUrl = packImg;
          break;
        }
      }
    }

    return {
      id: p.id,
      name: p.name,
      supplierCode: p.supplierCode,
      unitCost: p.unitCost.toString(),
      brand: p.brand,
      description: p.description,
      imageUrl: resolvedImageUrl,
      supplier: p.supplier,
      variants: p.variants.map((v) => ({
        id: v.id,
        color: v.color,
        variantLabel: v.variantLabel,
        stock: v.stock,
        productId: v.productId,
      })),
    };
  });

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
