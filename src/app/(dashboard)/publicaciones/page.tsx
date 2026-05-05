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
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { MLListingStatus } from "@/types";
import { SyncButton } from "./sync-button";
import { PublicacionesFilters } from "./publicaciones-filters";
import Link from "next/link";

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

export default async function PublicacionesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    packId?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page || "1", 10));
  const pageSize = 50;

  const where: {
    title?: { contains: string; mode: "insensitive" };
    mlItemId?: { contains: string; mode: "insensitive" };
    status?: MLListingStatus;
    packId?: string;
    OR?: Array<Record<string, unknown>>;
  } = {};

  if (params.q) {
    where.OR = [
      { title: { contains: params.q, mode: "insensitive" } },
      { mlItemId: { contains: params.q, mode: "insensitive" } },
    ];
  }

  if (params.status) {
    where.status = params.status as MLListingStatus;
  }

  if (params.packId) {
    where.packId = params.packId;
  }

  const [listings, totalCount, allPacks, lastSyncRecord] = await Promise.all([
    prisma.mLListing.findMany({
      where,
      include: {
        pack: { select: { id: true, sku: true, name: true, stock: true } },
      },
      orderBy: { lastSyncedAt: "desc" },
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
    }),
    prisma.mLListing.count({ where }),
    prisma.pack.findMany({
      select: { id: true, sku: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.mLListing.findFirst({
      where: { lastSyncedAt: { not: null } },
      orderBy: { lastSyncedAt: "desc" },
      select: { lastSyncedAt: true },
    }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);
  const lastSync = lastSyncRecord?.lastSyncedAt;

  // Stats
  const statusCounts = await prisma.mLListing.groupBy({
    by: ["status"],
    _count: true,
  });
  const totalListings = statusCounts.reduce((s, c) => s + c._count, 0);
  const activeCount =
    statusCounts.find((c) => c.status === "ACTIVE")?._count ?? 0;
  const pausedCount =
    statusCounts.find((c) => c.status === "PAUSED")?._count ?? 0;
  const closedCount =
    statusCounts.find((c) => c.status === "CLOSED")?._count ?? 0;

  const hasFilters = !!(params.q || params.status || params.packId);

  function buildPageUrl(page: number) {
    const p = new URLSearchParams();
    if (params.q) p.set("q", params.q);
    if (params.status) p.set("status", params.status);
    if (params.packId) p.set("packId", params.packId);
    if (page > 1) p.set("page", String(page));
    const qs = p.toString();
    return `/publicaciones${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Publicaciones MercadoLibre"
          description="Gestion de publicaciones vinculadas a packs"
        />
        <SyncButton lastSync={lastSync?.toISOString() ?? null} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-xl font-bold">{totalListings}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Activas</div>
          <div className="text-xl font-bold text-green-600">{activeCount}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Pausadas</div>
          <div className="text-xl font-bold text-amber-600">{pausedCount}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Cerradas</div>
          <div className="text-xl font-bold text-red-600">{closedCount}</div>
        </Card>
      </div>

      {/* Filters */}
      <PublicacionesFilters packs={allPacks} />

      {/* Results info */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {hasFilters
            ? `${totalCount} resultados filtrados`
            : `${totalCount} publicaciones`}
        </span>
        {totalPages > 1 && (
          <span>
            Pagina {currentPage} de {totalPages}
          </span>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">ML ID</TableHead>
                  <TableHead className="w-[100px]">Pack</TableHead>
                  <TableHead className="min-w-[200px]">Titulo</TableHead>
                  <TableHead className="w-[80px]">Estado</TableHead>
                  <TableHead className="w-[80px] text-right">Precio</TableHead>
                  <TableHead className="w-[60px] text-right">Stock ML</TableHead>
                  <TableHead className="w-[60px] text-right">Stock Calc</TableHead>
                  <TableHead className="w-[120px]">Sinc.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listings.map((listing) => {
                  const outOfSync =
                    listing.currentStock !== listing.pack.stock;
                  return (
                    <TableRow
                      key={listing.id}
                      className={`hover:bg-muted/50 ${outOfSync ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}`}
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {listing.mlItemId}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/publicaciones?packId=${listing.pack.id}`}
                          className="text-xs font-medium hover:underline"
                        >
                          {listing.pack.sku}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className="line-clamp-1 text-sm" title={listing.title || ""}>
                          {listing.title || "Sin titulo"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`text-xs ${STATUS_STYLES[listing.status]}`}
                        >
                          {STATUS_LABELS[listing.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {listing.currentPrice
                          ? formatCurrency(Number(listing.currentPrice))
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            outOfSync
                              ? "text-amber-600 font-medium"
                              : "text-sm"
                          }
                        >
                          {listing.currentStock}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {listing.pack.stock}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {listing.lastSyncedAt
                          ? formatDateTime(listing.lastSyncedAt)
                          : "Nunca"}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {listings.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-8 text-center text-muted-foreground"
                    >
                      {hasFilters
                        ? "No se encontraron publicaciones con esos filtros"
                        : "No hay publicaciones registradas"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {currentPage > 1 && (
            <Link
              href={buildPageUrl(currentPage - 1)}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
            >
              Anterior
            </Link>
          )}
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            let page: number;
            if (totalPages <= 7) {
              page = i + 1;
            } else if (currentPage <= 4) {
              page = i + 1;
            } else if (currentPage >= totalPages - 3) {
              page = totalPages - 6 + i;
            } else {
              page = currentPage - 3 + i;
            }
            return (
              <Link
                key={page}
                href={buildPageUrl(page)}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  page === currentPage
                    ? "bg-primary text-primary-foreground"
                    : "border hover:bg-muted"
                }`}
              >
                {page}
              </Link>
            );
          })}
          {currentPage < totalPages && (
            <Link
              href={buildPageUrl(currentPage + 1)}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
            >
              Siguiente
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
