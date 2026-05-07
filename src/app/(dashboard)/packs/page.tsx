export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
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

  const kpiCards = [
    { label: "TOTAL", value: totalPacks, color: "" },
    { label: "TIMI'S", value: tmsPacks, color: "text-blue-600" },
    { label: "ML IMPORT", value: mlPacks, color: "text-purple-600" },
    { label: "CON ITEMS", value: withItems, color: "text-success" },
    { label: "SIN ITEMS", value: noItems, color: "text-[oklch(0.48_0.13_70)]" },
  ];

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
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className="rounded-[9px] border border-border bg-card p-3.5 flex flex-col gap-1"
          >
            <div className="text-[10.5px] font-medium text-muted-foreground uppercase tracking-[0.06em]">
              {card.label}
            </div>
            <div className={`mono num text-xl font-semibold tracking-tight ${card.color}`}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      <PacksFilters />

      {/* Results info */}
      <div className="flex items-center justify-between text-[11.5px] text-muted-foreground">
        <span>
          {hasFilters ? `${totalCount} resultados` : `${totalCount} packs`}
        </span>
        {totalPages > 1 && (
          <span>Pagina {currentPage} de {totalPages}</span>
        )}
      </div>

      {/* Table */}
      <div className="rounded-[9px] border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em] w-[120px]">
                  SKU
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em] min-w-[200px]">
                  Nombre
                </th>
                <th className="px-3 py-2.5 text-right text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em] w-[100px]">
                  Precio
                </th>
                <th className="px-3 py-2.5 text-right text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em] w-[80px]">
                  Stock
                </th>
                <th className="px-3 py-2.5 text-right text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em] w-[60px]">
                  Items
                </th>
                <th className="px-3 py-2.5 text-right text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em] w-[60px]">
                  Pub.
                </th>
              </tr>
            </thead>
            <tbody>
              {packs.map((pack) => (
                <tr key={pack.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/packs/${pack.id}`}
                      className="mono text-[11.5px] text-muted-foreground hover:underline"
                    >
                      {pack.sku}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/packs/${pack.id}`}
                      className="line-clamp-1 hover:underline"
                      title={pack.name}
                    >
                      {pack.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {Number(pack.salePrice) > 0
                      ? formatCurrency(Number(pack.salePrice))
                      : "-"}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span
                      className={`mono text-[12px] font-semibold ${
                        pack.stock === 0
                          ? "text-destructive"
                          : pack.stock <= 5
                            ? "text-[oklch(0.48_0.13_70)]"
                            : "text-success"
                      }`}
                    >
                      {pack.stock}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {pack.items.length > 0 ? (
                      <Badge variant="secondary" className="text-[10.5px]">
                        {pack.items.length}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {pack._count.mlListings > 0 ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10.5px] font-medium bg-[oklch(0.58_0.10_155/0.12)] text-success">
                        {pack._count.mlListings}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                </tr>
              ))}
              {packs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground text-[12.5px]">
                    {hasFilters
                      ? "No se encontraron packs con esos filtros"
                      : "No hay packs registrados"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {currentPage > 1 && (
            <Link
              href={buildPageUrl(currentPage - 1)}
              className="rounded-md border border-border px-3 py-1.5 text-[12px] hover:bg-muted"
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
                className={`rounded-md px-3 py-1.5 text-[12px] ${
                  page === currentPage
                    ? "bg-foreground text-background font-medium"
                    : "border border-border hover:bg-muted"
                }`}
              >
                {page}
              </Link>
            );
          })}
          {currentPage < totalPages && (
            <Link
              href={buildPageUrl(currentPage + 1)}
              className="rounded-md border border-border px-3 py-1.5 text-[12px] hover:bg-muted"
            >
              Siguiente
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
