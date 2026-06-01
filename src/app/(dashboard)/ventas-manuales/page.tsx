export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
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
import { HandCoins } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ManualSaleCreateButton, type PackOption } from "./manual-sale-create-button";
import { ManualSaleDeleteButton } from "./manual-sale-delete-button";

type PackItemLite = {
  quantity: number;
  productVariant: { product: { unitCost: unknown } };
};

function packCost(items: PackItemLite[]) {
  return items.reduce((s, it) => s + it.quantity * Number(it.productVariant.product.unitCost), 0);
}
function packUnits(items: PackItemLite[]) {
  return items.reduce((s, it) => s + it.quantity, 0);
}

export default async function VentasManualesPage() {
  const [sales, packs] = await Promise.all([
    prisma.mPTransaction.findMany({
      where: { source: "manual" },
      include: {
        pack: {
          select: {
            id: true,
            sku: true,
            name: true,
            items: { select: { quantity: true, productVariant: { select: { product: { select: { unitCost: true } } } } } },
          },
        },
      },
      orderBy: { dateCreated: "desc" },
    }),
    prisma.pack.findMany({
      select: {
        id: true,
        sku: true,
        name: true,
        salePrice: true,
        items: { select: { quantity: true, productVariant: { select: { product: { select: { unitCost: true } } } } } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const packOptions: PackOption[] = packs.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    salePrice: Number(p.salePrice),
    units: packUnits(p.items),
    cost: packCost(p.items),
  }));

  const rows = sales.map((s) => {
    const monto = Number(s.amount);
    const costo = s.pack ? packCost(s.pack.items) * s.quantity : 0;
    return {
      id: s.id,
      date: s.dateCreated,
      label: s.pack ? s.pack.name : s.description || "Venta manual",
      sku: s.pack?.sku || null,
      channel: s.referenceId || null,
      quantity: s.quantity,
      monto,
      costo,
      neto: monto - costo,
      deductedStock: s.type === "manual_sale",
    };
  });

  const totalMonto = rows.reduce((s, r) => s + r.monto, 0);
  const totalCosto = rows.reduce((s, r) => s + r.costo, 0);
  const totalNeto = totalMonto - totalCosto;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ventas Manuales"
        description="Ventas hechas fuera de MercadoLibre. Entran a flujo de caja (no a la conciliacion del saldo MP)."
      >
        <ManualSaleCreateButton packs={packOptions} />
      </PageHeader>

      {rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border bg-card glass p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Ventas</p>
            <p className="text-xl font-bold mt-1">{rows.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card glass p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Ingresos</p>
            <p className="text-xl font-bold num margin-good mt-1">{formatCurrency(totalMonto)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card glass p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Costo mercancia</p>
            <p className="text-xl font-bold num mt-1">{formatCurrency(totalCosto)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card glass p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Ganancia</p>
            <p className={`text-xl font-bold num mt-1 ${totalNeto >= 0 ? "margin-good" : "margin-bad"}`}>{formatCurrency(totalNeto)}</p>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title="Sin ventas manuales"
          description="Registra aqui las ventas que hiciste fuera de MercadoLibre (efectivo, transferencia, etc.). Apareceran en el flujo de caja."
        />
      ) : (
        <div className="rounded-xl border border-border bg-card glass overflow-x-auto">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-[11px] uppercase tracking-wider">Fecha</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Producto / concepto</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider">Cant</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider">Monto</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider">Costo</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider">Neto</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Canal</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/50">
                  <TableCell className="text-[12.5px] text-muted-foreground whitespace-nowrap">{formatDate(r.date)}</TableCell>
                  <TableCell className="font-medium text-[12.5px] max-w-[260px]">
                    <span className="block truncate">{r.label}</span>
                    {r.sku && <span className="block text-[10px] text-muted-foreground">{r.sku}{!r.deductedStock ? " · sin descontar stock" : ""}</span>}
                  </TableCell>
                  <TableCell className="text-right num text-[12.5px]">{r.quantity}</TableCell>
                  <TableCell className="text-right num font-semibold margin-good">{formatCurrency(r.monto)}</TableCell>
                  <TableCell className="text-right num text-[12.5px] text-muted-foreground">{r.costo > 0 ? formatCurrency(r.costo) : "—"}</TableCell>
                  <TableCell className={`text-right num font-semibold ${r.neto >= 0 ? "margin-good" : "margin-bad"}`}>{formatCurrency(r.neto)}</TableCell>
                  <TableCell>
                    {r.channel ? <span className="tx-pill sale text-[10px]">{r.channel}</span> : <span className="text-[11px] text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <ManualSaleDeleteButton saleId={r.id} label={r.label} deductedStock={r.deductedStock} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
