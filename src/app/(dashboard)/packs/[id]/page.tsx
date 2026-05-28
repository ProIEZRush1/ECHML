export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { ColorBadge } from "@/components/shared/color-badge";
import { PackDetailActions } from "@/components/packs/pack-detail-actions";
import { formatCurrency, formatDateTime, getVariantDisplay } from "@/lib/utils";
import type { MLListingStatus, PackWithDetails } from "@/types";

interface PackDetailPageProps {
  params: Promise<{ id: string }>;
}

const STATUS_STYLES: Record<MLListingStatus, string> = {
  ACTIVE: "bg-[oklch(0.58_0.10_155/0.12)] text-success",
  PAUSED: "bg-[oklch(0.72_0.14_78/0.16)] text-[oklch(0.48_0.13_70)]",
  CLOSED: "bg-destructive/10 text-destructive",
  UNDER_REVIEW: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};

const STATUS_LABELS: Record<MLListingStatus, string> = {
  ACTIVE: "Activa",
  PAUSED: "Pausada",
  CLOSED: "Cerrada",
  UNDER_REVIEW: "En revision",
};

export default async function PackDetailPage({ params }: PackDetailPageProps) {
  const { id } = await params;

  const pack = await prisma.pack.findUnique({
    where: { id },
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
  });

  if (!pack) {
    notFound();
  }

  const packData: PackWithDetails = {
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
        variantLabel: item.productVariant.variantLabel,
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
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={pack.name}
        description={`SKU: ${pack.sku}`}
      >
        <PackDetailActions pack={packData} />
      </PageHeader>

      {/* Info cells: Precio / Stock / Publicaciones */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-[9px] border border-border bg-card glass p-3.5 flex flex-col gap-1">
          <div className="text-[10.5px] font-medium text-muted-foreground uppercase tracking-[0.06em]">
            Precio de Venta
          </div>
          <div className="mono num text-2xl font-semibold tracking-tight">
            {formatCurrency(pack.salePrice.toString())}
          </div>
        </div>
        <div className="rounded-[9px] border border-border bg-card glass p-3.5 flex flex-col gap-1">
          <div className="text-[10.5px] font-medium text-muted-foreground uppercase tracking-[0.06em]">
            Stock Calculado
          </div>
          <div
            className={`mono num text-2xl font-semibold tracking-tight ${
              pack.stock === 0
                ? "text-destructive"
                : pack.stock <= 5
                  ? "text-[oklch(0.48_0.13_70)]"
                  : "text-success"
            }`}
          >
            {pack.stock}
          </div>
        </div>
        <div className="rounded-[9px] border border-border bg-card glass p-3.5 flex flex-col gap-1">
          <div className="text-[10.5px] font-medium text-muted-foreground uppercase tracking-[0.06em]">
            Publicaciones
          </div>
          <div className="mono num text-2xl font-semibold tracking-tight">
            {pack.mlListings.length}
          </div>
        </div>
      </div>

      {/* Stock sync status */}
      <div className="rounded-[9px] border border-border bg-card glass px-4 py-3 flex items-center gap-3">
        <span className="text-[12.5px] font-medium text-muted-foreground">Sincronizacion de stock:</span>
        {pack.stockSyncEnabled ? (
          <Badge variant="default">Sincronizado automaticamente</Badge>
        ) : (
          <Badge variant="secondary">FULL - Stock gestionado por ML</Badge>
        )}
      </div>

      {/* Description */}
      {pack.description && (
        <div className="rounded-[9px] border border-border bg-card glass overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <h3 className="text-[12.5px] font-semibold">Descripcion</h3>
          </div>
          <div className="px-4 py-3">
            <p className="text-[12.5px] text-muted-foreground">{pack.description}</p>
          </div>
        </div>
      )}

      {/* Composition table */}
      <div className="rounded-[9px] border border-border bg-card glass overflow-x-auto">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
          <h3 className="text-[12.5px] font-semibold">Composicion</h3>
          <span className="text-[11px] text-muted-foreground">{pack.items.length} items</span>
        </div>
        <table className="w-full min-w-[600px] text-[12.5px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                Producto
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                Codigo
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                Variante
              </th>
              <th className="px-3 py-2.5 text-center text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                Cant / Pack
              </th>
              <th className="px-3 py-2.5 text-right text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                Stock Disp.
              </th>
            </tr>
          </thead>
          <tbody>
            {pack.items.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                <td className="px-3 py-2.5 font-medium">
                  {item.productVariant.product.name}
                </td>
                <td className="px-3 py-2.5 mono text-[11.5px] text-muted-foreground">
                  {item.productVariant.product.supplierCode}
                </td>
                <td className="px-3 py-2.5">
                  <ColorBadge
                    color={item.productVariant.color}
                    variantLabel={item.productVariant.variantLabel}
                  />
                </td>
                <td className="px-3 py-2.5 text-center mono">{item.quantity}</td>
                <td className="px-3 py-2.5 text-right">
                  <span
                    className={`mono text-[12px] font-semibold ${
                      item.productVariant.stock === 0
                        ? "text-destructive"
                        : item.productVariant.stock <= 5
                          ? "text-[oklch(0.48_0.13_70)]"
                          : "text-success"
                    }`}
                  >
                    {item.productVariant.stock}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stock calculation */}
      <div className="rounded-[9px] border border-border bg-card glass overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <h3 className="text-[12.5px] font-semibold">Calculo de Stock</h3>
        </div>
        <div className="px-4 py-3 space-y-2">
          {pack.items.map((item) => {
            const maxPacks = Math.floor(item.productVariant.stock / item.quantity);
            return (
              <div key={item.id} className="flex items-center justify-between text-[12.5px]">
                <span className="flex items-center gap-2">
                  <ColorBadge
                    color={item.productVariant.color}
                    variantLabel={item.productVariant.variantLabel}
                    showLabel={false}
                  />
                  <span>{item.productVariant.product.name}</span>
                  <span className="text-muted-foreground mono text-[11px]">
                    ({item.productVariant.stock} / {item.quantity} por pack)
                  </span>
                </span>
                <span className="mono font-medium">{maxPacks} packs posibles</span>
              </div>
            );
          })}
          <div className="border-t border-border pt-2.5 mt-2.5 flex items-center justify-between">
            <span className="text-[12.5px] font-medium">Stock final (limitante)</span>
            <span
              className={`mono num text-[14px] font-semibold ${
                pack.stock === 0
                  ? "text-destructive"
                  : pack.stock <= 5
                    ? "text-[oklch(0.48_0.13_70)]"
                    : "text-success"
              }`}
            >
              {pack.stock}
            </span>
          </div>
        </div>
      </div>

      {/* Linked ML Listings */}
      {pack.mlListings.length > 0 && (
        <div className="rounded-[9px] border border-border bg-card glass overflow-x-auto">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
            <h3 className="text-[12.5px] font-semibold">Publicaciones Vinculadas</h3>
            <span className="text-[11px] text-muted-foreground">{pack.mlListings.length} publicaciones</span>
          </div>
          <table className="w-full min-w-[600px] text-[12.5px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                  ML ID
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                  Titulo
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                  Estado
                </th>
                <th className="px-3 py-2.5 text-right text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                  Stock Sinc.
                </th>
                <th className="px-3 py-2.5 text-right text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                  Ultima Sinc.
                </th>
              </tr>
            </thead>
            <tbody>
              {pack.mlListings.map((listing) => (
                <tr key={listing.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                  <td className="px-3 py-2.5 mono text-[11.5px] text-muted-foreground">
                    {listing.mlItemId}
                  </td>
                  <td className="px-3 py-2.5">{listing.title || "Sin titulo"}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium ${STATUS_STYLES[listing.status]}`}>
                      {STATUS_LABELS[listing.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right mono">{listing.currentStock}</td>
                  <td className="px-3 py-2.5 text-right text-[11px] text-muted-foreground">
                    {listing.lastSyncedAt
                      ? formatDateTime(listing.lastSyncedAt)
                      : "Nunca"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
