import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { PackTable } from "@/components/packs/pack-table";
import type { PackWithDetails } from "@/types";

export default async function PacksPage() {
  const packs = await prisma.pack.findMany({
    include: {
      items: {
        include: {
          productVariant: {
            include: {
              product: true,
            },
          },
        },
      },
      mlListings: true,
    },
    orderBy: { sku: "asc" },
  });

  const packsData: PackWithDetails[] = packs.map((pack) => ({
    id: pack.id,
    sku: pack.sku,
    name: pack.name,
    salePrice: pack.salePrice.toString(),
    stock: pack.stock,
    description: pack.description,
    items: pack.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      productVariant: {
        id: item.productVariant.id,
        color: item.productVariant.color,
        stock: item.productVariant.stock,
        product: {
          id: item.productVariant.product.id,
          name: item.productVariant.product.name,
          supplierCode: item.productVariant.product.supplierCode,
        },
      },
    })),
    mlListings: pack.mlListings.map((listing) => ({
      id: listing.id,
      mlItemId: listing.mlItemId,
      title: listing.title,
      status: listing.status,
      currentStock: listing.currentStock,
      currentPrice: listing.currentPrice?.toString() ?? null,
      lastSyncedAt: listing.lastSyncedAt,
    })),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Packs"
        description="Bundles de productos para publicaciones ML"
      />
      <PackTable packs={packsData} />
    </div>
  );
}
