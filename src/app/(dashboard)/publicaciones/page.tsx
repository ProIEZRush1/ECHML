export const dynamic = "force-dynamic";

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
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import type { MLListingStatus } from "@/types";
import { SyncButton } from "./sync-button";

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

export default async function PublicacionesPage() {
  const listings = await prisma.mLListing.findMany({
    include: {
      pack: {
        select: { sku: true, stock: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Get the most recent sync timestamp
  const lastSync = listings.reduce<Date | null>((latest, listing) => {
    if (!listing.lastSyncedAt) return latest;
    if (!latest) return listing.lastSyncedAt;
    return listing.lastSyncedAt > latest ? listing.lastSyncedAt : latest;
  }, null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Publicaciones MercadoLibre"
        description="Gestion de publicaciones vinculadas a packs"
      >
        <SyncButton lastSync={lastSync?.toISOString() ?? null} />
      </PageHeader>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ML ID</TableHead>
              <TableHead>Pack SKU</TableHead>
              <TableHead>Titulo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Stock en ML</TableHead>
              <TableHead className="text-right">Stock Calculado</TableHead>
              <TableHead>Ultima Sinc.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listings.map((listing) => {
              const outOfSync = listing.currentStock !== listing.pack.stock;
              return (
                <TableRow
                  key={listing.id}
                  className={outOfSync ? "bg-amber-50 dark:bg-amber-950/20" : ""}
                >
                  <TableCell className="font-mono text-sm">
                    {listing.mlItemId}
                  </TableCell>
                  <TableCell className="font-medium">{listing.pack.sku}</TableCell>
                  <TableCell>{listing.title || "Sin titulo"}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_STYLES[listing.status]}>
                      {STATUS_LABELS[listing.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={outOfSync ? "text-amber-600 font-medium" : ""}>
                      {listing.currentStock}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {listing.pack.stock}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {listing.lastSyncedAt
                      ? formatDateTime(listing.lastSyncedAt)
                      : "Nunca"}
                  </TableCell>
                </TableRow>
              );
            })}
            {listings.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No hay publicaciones registradas
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
