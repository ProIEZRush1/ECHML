export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
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
import { ShoppingCart } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; packId?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page || "1", 10));
  const pageSize = 50;

  const where: { label: string; packId?: string } = { label: "sale" };
  if (params.packId) where.packId = params.packId;

  const [sales, totalCount, totalRevenue, allPacks] = await Promise.all([
    prisma.mPTransaction.findMany({
      where,
      orderBy: { dateCreated: "desc" },
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
      include: {
        pack: { select: { id: true, sku: true, name: true, imageUrl: true } },
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
    if (page > 1) p.set("page", String(page));
    const qs = p.toString();
    return `/ventas${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ventas"
        description="Historial de ventas sincronizadas desde MercadoLibre"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Total Ventas</div>
          <div className="text-xl font-bold">{totalCount}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Ingresos Brutos</div>
          <div className="text-xl font-bold text-green-600 truncate">
            {formatCurrency(revenue)}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Packs con Ventas</div>
          <div className="text-xl font-bold">{allPacks.length}</div>
        </Card>
      </div>

      {/* Pack filter */}
      {allPacks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Link
            href="/ventas"
            className={`rounded-md px-3 py-1.5 text-sm ${
              !params.packId
                ? "bg-primary text-primary-foreground"
                : "border hover:bg-muted"
            }`}
          >
            Todos
          </Link>
          {allPacks.slice(0, 20).map((pack) => (
            <Link
              key={pack.id}
              href={`/ventas?packId=${pack.id}`}
              className={`rounded-md px-3 py-1.5 text-sm truncate max-w-[200px] ${
                params.packId === pack.id
                  ? "bg-primary text-primary-foreground"
                  : "border hover:bg-muted"
              }`}
              title={pack.name}
            >
              {pack.sku}
            </Link>
          ))}
        </div>
      )}

      {/* Info */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{totalCount} ventas{params.packId ? " (filtrado)" : ""}</span>
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
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Fecha</TableHead>
                    <TableHead className="w-[100px]">Pack</TableHead>
                    <TableHead className="min-w-[200px]">Producto</TableHead>
                    <TableHead className="w-[100px] text-right">Monto</TableHead>
                    <TableHead className="w-[100px] text-right">Neto</TableHead>
                    <TableHead className="w-[80px]">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale) => (
                    <TableRow key={sale.id} className="hover:bg-muted/50">
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(sale.dateCreated)}
                      </TableCell>
                      <TableCell>
                        {sale.pack ? (
                          <Link
                            href={`/ventas?packId=${sale.pack.id}`}
                            className="text-xs font-mono hover:underline"
                          >
                            {sale.pack.sku}
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm line-clamp-1" title={sale.description || ""}>
                          {sale.description || "Venta ML"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium text-green-600">
                        {formatCurrency(Number(sale.amount))}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {formatCurrency(Number(sale.balanceChange))}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800 text-xs">
                          {sale.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {currentPage > 1 && (
            <Link href={buildPageUrl(currentPage - 1)} className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
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
                  page === currentPage ? "bg-primary text-primary-foreground" : "border hover:bg-muted"
                }`}
              >
                {page}
              </Link>
            );
          })}
          {currentPage < totalPages && (
            <Link href={buildPageUrl(currentPage + 1)} className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
              Siguiente
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
