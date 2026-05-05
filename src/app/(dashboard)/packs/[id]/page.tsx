export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ColorBadge } from "@/components/shared/color-badge";
import { StockIndicator } from "@/components/shared/stock-indicator";
import { PackDetailActions } from "@/components/packs/pack-detail-actions";
import { formatCurrency, formatDateTime, getVariantDisplay } from "@/lib/utils";
import type { MLListingStatus, PackWithDetails } from "@/types";

interface PackDetailPageProps {
  params: Promise<{ id: string }>;
}

const STATUS_STYLES: Record<MLListingStatus, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  PAUSED: "bg-amber-100 text-amber-800",
  CLOSED: "bg-red-100 text-red-800",
  UNDER_REVIEW: "bg-blue-100 text-blue-800",
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

      {/* Pack Info */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Precio de Venta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(pack.salePrice.toString())}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Stock Calculado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StockIndicator stock={pack.stock} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Publicaciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pack.mlListings.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Stock Sync Status */}
      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          <span className="text-sm font-medium text-muted-foreground">Sincronizacion de stock:</span>
          {pack.stockSyncEnabled ? (
            <Badge variant="default">Sincronizado automaticamente</Badge>
          ) : (
            <Badge variant="secondary">FULL - Stock gestionado por ML</Badge>
          )}
        </CardContent>
      </Card>

      {/* Description */}
      {pack.description && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Descripcion</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{pack.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Composition */}
      <Card>
        <CardHeader>
          <CardTitle>Composicion</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Codigo</TableHead>
                <TableHead>Variante</TableHead>
                <TableHead className="text-center">Cantidad por Pack</TableHead>
                <TableHead className="text-right">Stock Disponible</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pack.items.map((item) => {
                const display = getVariantDisplay({
                  color: item.productVariant.color,
                  variantLabel: item.productVariant.variantLabel,
                });
                return (
                  <TableRow key={item.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      {item.productVariant.product.name}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {item.productVariant.product.supplierCode}
                    </TableCell>
                    <TableCell>
                      <ColorBadge
                        color={item.productVariant.color}
                        variantLabel={item.productVariant.variantLabel}
                      />
                    </TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell className="text-right">
                      <StockIndicator stock={item.productVariant.stock} showBadge={false} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Stock Calculation */}
      <Card>
        <CardHeader>
          <CardTitle>Calculo de Stock</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {pack.items.map((item) => {
              const maxPacks = Math.floor(item.productVariant.stock / item.quantity);
              const display = getVariantDisplay({
                color: item.productVariant.color,
                variantLabel: item.productVariant.variantLabel,
              });
              return (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <ColorBadge
                      color={item.productVariant.color}
                      variantLabel={item.productVariant.variantLabel}
                      showLabel={false}
                    />
                    <span>{item.productVariant.product.name}</span>
                    <span className="text-muted-foreground">
                      ({item.productVariant.stock} / {item.quantity} por pack)
                    </span>
                  </span>
                  <span className="font-medium">{maxPacks} packs posibles</span>
                </div>
              );
            })}
            <div className="border-t pt-2 mt-2 flex items-center justify-between font-medium">
              <span>Stock final (limitante)</span>
              <StockIndicator stock={pack.stock} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Linked ML Listings */}
      {pack.mlListings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Publicaciones Vinculadas</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ML ID</TableHead>
                  <TableHead>Titulo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Stock Sincronizado</TableHead>
                  <TableHead className="text-right">Ultima Sinc.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pack.mlListings.map((listing) => (
                  <TableRow key={listing.id} className="hover:bg-muted/50">
                    <TableCell className="font-mono text-sm">
                      {listing.mlItemId}
                    </TableCell>
                    <TableCell>{listing.title || "Sin titulo"}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_STYLES[listing.status]}>
                        {STATUS_LABELS[listing.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{listing.currentStock}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {listing.lastSyncedAt
                        ? formatDateTime(listing.lastSyncedAt)
                        : "Nunca"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
