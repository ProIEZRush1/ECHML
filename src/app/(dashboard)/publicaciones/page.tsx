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
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { MLListingStatus } from "@/types";
import { SyncButton } from "./sync-button";
import { PublicacionesFilters } from "./publicaciones-filters";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

const COLOR_DOT: Record<string, string> = {
  AZUL: "bg-blue-500",
  VERDE: "bg-green-500",
  ROSA: "bg-pink-400",
  MORADO: "bg-purple-500",
};

const COLOR_LABEL: Record<string, string> = {
  AZUL: "Azul",
  VERDE: "Verde",
  ROSA: "Rosa",
  MORADO: "Morado",
};

const STATUS_CSS: Record<MLListingStatus, string> = {
  ACTIVE: "list-status active",
  PAUSED: "list-status paused",
  CLOSED: "list-status closed",
  UNDER_REVIEW: "tx-pill tax",
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
        pack: {
        select: {
          id: true,
          sku: true,
          name: true,
          stock: true,
          items: {
            select: {
              productVariant: {
                select: { color: true, product: { select: { name: true } } },
              },
            },
          },
        },
      },
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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Publicaciones MercadoLibre"
          description="Gestion de publicaciones vinculadas a packs"
        />
        <SyncButton lastSync={lastSync?.toISOString() ?? null} />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-[9px] border border-border bg-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Total</p>
          <p className="text-2xl font-bold mt-1 num">{totalListings}</p>
        </div>
        <div className="rounded-[9px] border border-border bg-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Activas</p>
          <p className="text-2xl font-bold mt-1 num margin-good">{activeCount}</p>
        </div>
        <div className="rounded-[9px] border border-border bg-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Pausadas</p>
          <p className="text-2xl font-bold mt-1 num margin-warn">{pausedCount}</p>
        </div>
        <div className="rounded-[9px] border border-border bg-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Cerradas</p>
          <p className="text-2xl font-bold mt-1 num margin-bad">{closedCount}</p>
        </div>
      </div>

      {/* Filters */}
      <PublicacionesFilters packs={allPacks} />

      {/* Results info */}
      <div className="flex items-center justify-between text-[12px] text-muted-foreground">
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
      <div className="rounded-[9px] border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[140px] text-[11px] uppercase tracking-wider">ML ID</TableHead>
                <TableHead className="w-[100px] text-[11px] uppercase tracking-wider">Pack</TableHead>
                <TableHead className="w-[120px] text-[11px] uppercase tracking-wider">Colores</TableHead>
                <TableHead className="min-w-[200px] text-[11px] uppercase tracking-wider">Titulo</TableHead>
                <TableHead className="w-[80px] text-[11px] uppercase tracking-wider">Estado</TableHead>
                <TableHead className="w-[80px] text-right text-[11px] uppercase tracking-wider">Precio</TableHead>
                <TableHead className="w-[60px] text-right text-[11px] uppercase tracking-wider">Stock ML</TableHead>
                <TableHead className="w-[60px] text-right text-[11px] uppercase tracking-wider">Stock Calc</TableHead>
                <TableHead className="w-[120px] text-[11px] uppercase tracking-wider">Sinc.</TableHead>
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
                    <TableCell className="mono text-[11.5px] text-muted-foreground">
                      {listing.mlItemId}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/packs/${listing.pack.id}`}
                          className="text-[11.5px] font-medium hover:underline"
                          title={listing.pack.name}
                        >
                          {listing.pack.sku}
                        </Link>
                        <Link
                          href={`/packs/${listing.pack.id}`}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        {listing.pack.items.map((item, idx) => {
                          const color = item.productVariant.color;
                          if (!color) return null;
                          return (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
                              title={`${item.productVariant.product.name} - ${COLOR_LABEL[color]}`}
                            >
                              <span className={`inline-block h-2.5 w-2.5 rounded-full ${COLOR_DOT[color] || "bg-gray-400"}`} />
                              <span className="hidden sm:inline">{COLOR_LABEL[color]}</span>
                            </span>
                          );
                        })}
                        {listing.pack.items.every((item) => !item.productVariant.color) && (
                          <span className="text-[10px] text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="line-clamp-1 text-[12.5px]" title={listing.title || ""}>
                        {listing.title || "Sin titulo"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={STATUS_CSS[listing.status]}>
                        {STATUS_LABELS[listing.status]}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-[12.5px] num">
                      {listing.currentPrice
                        ? formatCurrency(Number(listing.currentPrice))
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right num">
                      <span
                        className={
                          outOfSync
                            ? "margin-warn font-semibold text-[12.5px]"
                            : "text-[12.5px]"
                        }
                      >
                        {listing.currentStock}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-[12.5px] num font-semibold">
                      {listing.pack.stock}
                    </TableCell>
                    <TableCell className="text-[11.5px] text-muted-foreground">
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
                    colSpan={9}
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
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {currentPage > 1 && (
            <Link
              href={buildPageUrl(currentPage - 1)}
              className="filt-input hover:border-muted-foreground"
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
                className={`filt-input ${page === currentPage ? "active" : ""}`}
              >
                {page}
              </Link>
            );
          })}
          {currentPage < totalPages && (
            <Link
              href={buildPageUrl(currentPage + 1)}
              className="filt-input hover:border-muted-foreground"
            >
              Siguiente
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
