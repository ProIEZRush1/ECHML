export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShoppingCart } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { VentasSearch } from "./ventas-search";

const VARIANT_DOT: Record<string, string> = {
  AZUL: "bg-blue-500", VERDE: "bg-green-500", ROSA: "bg-pink-400", MORADO: "bg-purple-500",
};
const LABEL_DOT: Record<string, string> = {
  "Blanco": "bg-white border border-gray-300", "Negro": "bg-black", "Gris": "bg-gray-400",
  "Multicolor": "bg-gradient-to-r from-blue-500 via-green-500 to-pink-500",
  "Azul": "bg-blue-500", "Verde": "bg-green-500", "Rosa": "bg-pink-400", "Morado": "bg-purple-500",
};

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; packId?: string; q?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page || "1", 10));
  const pageSize = 50;
  const q = params.q?.trim() || "";

  const where: Prisma.MPTransactionWhereInput = { label: "sale" };
  if (params.packId) where.packId = params.packId;

  if (q) {
    const orConditions: Prisma.MPTransactionWhereInput[] = [
      { description: { contains: q, mode: "insensitive" } },
      { referenceId: { contains: q } },
      { pack: { sku: { contains: q, mode: "insensitive" } } },
      { pack: { name: { contains: q, mode: "insensitive" } } },
    ];

    if (/^\d+$/.test(q)) {
      try {
        const bigQ = BigInt(q);
        orConditions.push({ mlOrderId: bigQ });
        orConditions.push({ mlPackId: bigQ });
      } catch {
        // ignore if BigInt conversion fails
      }
    }

    where.OR = orConditions;
  }

  const [sales, totalCount, totalRevenue, allPacks] = await Promise.all([
    prisma.mPTransaction.findMany({
      where,
      orderBy: { dateCreated: "desc" },
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
      include: {
        pack: {
          select: {
            id: true,
            sku: true,
            name: true,
            imageUrl: true,
            items: {
              select: {
                quantity: true,
                productVariant: {
                  select: { color: true, variantLabel: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.mPTransaction.count({ where }),
    prisma.mPTransaction.aggregate({
      where,
      _sum: { amount: true },
    }),
    prisma.pack.findMany({
      where: {
        mpTransactions: { some: { label: "sale" } },
      },
      select: { id: true, sku: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);
  const revenue = Number(totalRevenue._sum.amount ?? 0);

  function buildPageUrl(page: number) {
    const p = new URLSearchParams();
    if (params.packId) p.set("packId", params.packId);
    if (q) p.set("q", q);
    if (page > 1) p.set("page", String(page));
    const qs = p.toString();
    return `/ventas${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ventas"
        description="Historial de ventas sincronizadas desde MercadoLibre"
      />

      <VentasSearch />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-[9px] border border-border bg-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Total Ventas</p>
          <p className="text-2xl font-bold mt-1 num">{totalCount}</p>
        </div>
        <div className="rounded-[9px] border border-border bg-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Ingresos Brutos</p>
          <p className="text-2xl font-bold mt-1 num truncate margin-good">
            {formatCurrency(revenue)}
          </p>
        </div>
        <div className="rounded-[9px] border border-border bg-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Packs con Ventas</p>
          <p className="text-2xl font-bold mt-1 num">{allPacks.length}</p>
        </div>
      </div>

      {/* Pack filter pills */}
      {allPacks.length > 0 && (
        <div className="filt-bar overflow-x-auto">
          <span className="lbl">Pack</span>
          <Link
            href="/ventas"
            className={`filt-input ${!params.packId ? "active" : ""}`}
          >
            Todos
          </Link>
          {allPacks.slice(0, 20).map((pack) => (
            <Link
              key={pack.id}
              href={`/ventas?packId=${pack.id}`}
              className={`filt-input truncate max-w-[200px] ${
                params.packId === pack.id ? "active" : ""
              }`}
              title={pack.name}
            >
              {pack.sku}
            </Link>
          ))}
        </div>
      )}

      {/* Results info */}
      <div className="flex items-center justify-between text-[12px] text-muted-foreground">
        <span>{totalCount} ventas{params.packId || q ? " (filtrado)" : ""}</span>
        {totalPages > 1 && (
          <span>Pagina {currentPage} de {totalPages}</span>
        )}
      </div>

      {sales.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Sin ventas registradas"
          description="Sincroniza con MP desde Flujo de Caja para ver las ventas aqui."
        />
      ) : (
        <div className="rounded-[9px] border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[90px] text-[11px] uppercase tracking-wider">Fecha</TableHead>
                  <TableHead className="w-[44px] text-[11px] uppercase tracking-wider"></TableHead>
                  <TableHead className="max-w-[300px] text-[11px] uppercase tracking-wider">Producto</TableHead>
                  <TableHead className="w-[90px] text-[11px] uppercase tracking-wider">Pack</TableHead>
                  <TableHead className="w-[50px] text-center text-[11px] uppercase tracking-wider">Cant</TableHead>
                  <TableHead className="w-[100px] text-right text-[11px] uppercase tracking-wider">Monto</TableHead>
                  <TableHead className="w-[100px] text-right text-[11px] uppercase tracking-wider">Neto</TableHead>
                  <TableHead className="w-[80px] text-[11px] uppercase tracking-wider">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((sale) => {
                  const rowHref = sale.packId
                    ? `/flujo-caja?packIds=${sale.packId}`
                    : undefined;
                  return (
                    <TableRow key={sale.id} className="hover:bg-muted/50 group">
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        <div className="text-[12.5px]">
                          {rowHref ? (
                            <Link href={rowHref} className="hover:underline">
                              {formatDateTime(sale.dateCreated)}
                            </Link>
                          ) : (
                            formatDateTime(sale.dateCreated)
                          )}
                        </div>
                        {sale.mlPackId && (
                          <div className="text-[10px] text-muted-foreground/60 mono">
                            pack {String(sale.mlPackId)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="px-1">
                        {sale.pack?.imageUrl ? (
                          <div className="shrink-0 h-8 w-8 rounded overflow-hidden border bg-muted">
                            <Image
                              src={sale.pack.imageUrl}
                              alt={sale.pack.name}
                              width={32}
                              height={32}
                              className="h-full w-full object-cover"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                            <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        {rowHref ? (
                          <Link href={rowHref} className="block truncate text-[12.5px] hover:underline" title={sale.description || ""}>
                            {sale.description || "Venta ML"}
                          </Link>
                        ) : (
                          <span className="block truncate text-[12.5px]" title={sale.description || ""}>
                            {sale.description || "Venta ML"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {sale.pack ? (
                          <div>
                            <Link
                              href={`/ventas?packId=${sale.pack.id}`}
                              className="mono text-[11.5px] hover:underline"
                            >
                              {sale.pack.sku}
                            </Link>
                            {sale.pack.items.length > 0 && (
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                {sale.pack.items.map((item, idx) => {
                                  const dotClass = (item.productVariant.color && VARIANT_DOT[item.productVariant.color])
                                    || (item.productVariant.variantLabel && LABEL_DOT[item.productVariant.variantLabel.split(" / ")[0]]);
                                  const label = item.productVariant.variantLabel || (item.productVariant.color || "");
                                  return (
                                    <span key={idx} className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                      {dotClass && (
                                        <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${dotClass}`} title={label} />
                                      )}
                                      {item.quantity > 1 && <span>×{item.quantity}</span>}
                                      {!dotClass && <span>{label}</span>}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11.5px] text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center num text-[12.5px]">
                        {sale.quantity}
                      </TableCell>
                      <TableCell className="text-right num text-[12.5px] font-semibold margin-good">
                        {formatCurrency(Number(sale.amount))}
                      </TableCell>
                      <TableCell className="text-right num text-[12.5px] text-muted-foreground">
                        {formatCurrency(Number(sale.balanceChange))}
                      </TableCell>
                      <TableCell>
                        <span className="tx-pill sale">{sale.status}</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {currentPage > 1 && (
            <Link href={buildPageUrl(currentPage - 1)} className="filt-input hover:border-muted-foreground">
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
                className={`filt-input ${page === currentPage ? "active" : ""}`}
              >
                {page}
              </Link>
            );
          })}
          {currentPage < totalPages && (
            <Link href={buildPageUrl(currentPage + 1)} className="filt-input hover:border-muted-foreground">
              Siguiente
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
