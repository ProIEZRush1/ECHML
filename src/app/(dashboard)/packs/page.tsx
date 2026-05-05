export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { PackCreateButton } from "@/components/packs/pack-create-button";
import { PacksFilters } from "./packs-filters";
import Link from "next/link";

export default async function PacksPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    type?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page || "1", 10));
  const pageSize = 50;

  const where: {
    name?: { contains: string; mode: "insensitive" };
    sku?: { contains: string; mode: "insensitive" };
    OR?: Array<Record<string, unknown>>;
    items?: { some: {} } | { none: {} };
  } = {};

  if (params.q) {
    where.OR = [
      { name: { contains: params.q, mode: "insensitive" } },
      { sku: { contains: params.q, mode: "insensitive" } },
    ];
  }

  if (params.type === "tms") {
    where.sku = { contains: "TM-", mode: "insensitive" };
  } else if (params.type === "ml") {
    where.sku = { contains: "ML-", mode: "insensitive" };
  } else if (params.type === "with-items") {
    where.items = { some: {} };
  } else if (params.type === "no-items") {
    where.items = { none: {} };
  }

  const [packs, totalCount] = await Promise.all([
    prisma.pack.findMany({
      where,
      include: {
        items: {
          include: {
            productVariant: {
              include: { product: { select: { name: true, supplierCode: true } } },
            },
          },
        },
        _count: { select: { mlListings: true } },
      },
      orderBy: { name: "asc" },
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
    }),
    prisma.pack.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  // Stats
  const [totalPacks, tmsPacks, mlPacks, withItems, noItems] = await Promise.all([
    prisma.pack.count(),
    prisma.pack.count({ where: { sku: { startsWith: "TM-" } } }),
    prisma.pack.count({ where: { sku: { startsWith: "ML-" } } }),
    prisma.pack.count({ where: { items: { some: {} } } }),
    prisma.pack.count({ where: { items: { none: {} } } }),
  ]);

  const hasFilters = !!(params.q || params.type);

  function buildPageUrl(page: number) {
    const p = new URLSearchParams();
    if (params.q) p.set("q", params.q);
    if (params.type) p.set("type", params.type);
    if (page > 1) p.set("page", String(page));
    const qs = p.toString();
    return `/packs${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Packs"
          description="Bundles de productos para publicaciones ML"
        />
        <PackCreateButton />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-xl font-bold">{totalPacks}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Timi&apos;s</div>
          <div className="text-xl font-bold text-blue-600">{tmsPacks}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">ML Import</div>
          <div className="text-xl font-bold text-purple-600">{mlPacks}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Con Items</div>
          <div className="text-xl font-bold text-green-600">{withItems}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Sin Items</div>
          <div className="text-xl font-bold text-amber-600">{noItems}</div>
        </Card>
      </div>

      <PacksFilters />

      {/* Results info */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {hasFilters ? `${totalCount} resultados` : `${totalCount} packs`}
        </span>
        {totalPages > 1 && (
          <span>Pagina {currentPage} de {totalPages}</span>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">SKU</TableHead>
                  <TableHead className="min-w-[200px]">Nombre</TableHead>
                  <TableHead className="w-[100px] text-right">Precio</TableHead>
                  <TableHead className="w-[80px] text-right">Stock</TableHead>
                  <TableHead className="w-[60px] text-right">Items</TableHead>
                  <TableHead className="w-[60px] text-right">Pub.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packs.map((pack) => (
                  <TableRow key={pack.id} className="hover:bg-muted/50">
                    <TableCell>
                      <Link
                        href={`/packs/${pack.id}`}
                        className="font-mono text-xs hover:underline"
                      >
                        {pack.sku}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/packs/${pack.id}`}
                        className="text-sm line-clamp-1 hover:underline"
                        title={pack.name}
                      >
                        {pack.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {Number(pack.salePrice) > 0
                        ? formatCurrency(Number(pack.salePrice))
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`text-sm font-medium ${
                          pack.stock > 10
                            ? "text-green-600"
                            : pack.stock > 0
                              ? "text-amber-600"
                              : "text-red-600"
                        }`}
                      >
                        {pack.stock}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {pack.items.length > 0 ? (
                        <Badge variant="secondary" className="text-xs">
                          {pack.items.length}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {pack._count.mlListings > 0 ? (
                        <Badge className="bg-green-100 text-green-800 text-xs">
                          {pack._count.mlListings}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {packs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      {hasFilters
                        ? "No se encontraron packs con esos filtros"
                        : "No hay packs registrados"}
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
            if (totalPages <= 7) page = i + 1;
            else if (currentPage <= 4) page = i + 1;
            else if (currentPage >= totalPages - 3) page = totalPages - 6 + i;
            else page = currentPage - 3 + i;
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
