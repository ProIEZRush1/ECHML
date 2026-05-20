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
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { ContabilidadAds } from "./contabilidad-ads";
import { ContabilidadFilters } from "./contabilidad-filters";
import { CheckCircle2, AlertTriangle } from "lucide-react";

interface GroupAccounting {
  groupId: string | null;
  groupName: string;
  groupColor: string;
  ingresos: number;
  comisiones: number;
  envios: number;
  impuestos: number;
  costoProducto: number;
  gastos: number;
  compras: number;
  flex: number;
  devoluciones: number;
  utilidad: number;
  retiros: number;
  saldo: number;
  salesCount: number;
}

export default async function ContabilidadPage({
  searchParams,
}: {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string }>;
}) {
  const params = await searchParams;

  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 30);
  const dateFrom = params.dateFrom || defaultFrom.toISOString().split("T")[0];
  const dateTo = params.dateTo || new Date().toISOString().split("T")[0];

  const dateGte = new Date(`${dateFrom}T00:00:00.000Z`);
  const dateLte = new Date(`${dateTo}T23:59:59.999Z`);

  // 1. Build group-to-pack mapping
  const [groups, allTransactions, expenses, withdrawals, returnedOrders, packsWithCosts, listings] = await Promise.all([
    prisma.productGroup.findMany({
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                variants: {
                  select: {
                    id: true,
                    packItems: { select: { packId: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.mPTransaction.findMany({
      where: { dateCreated: { gte: dateGte, lte: dateLte } },
      select: { amount: true, label: true, packId: true, quantity: true, mlOrderId: true },
    }),
    prisma.expense.findMany({
      where: { date: { gte: dateGte, lte: dateLte } },
      select: { id: true, amount: true, type: true, category: true, packId: true, productId: true, productGroupId: true, transactionIds: true },
    }),
    prisma.withdrawal.findMany({
      where: { date: { gte: dateGte, lte: dateLte } },
      select: { id: true, amount: true, productGroupId: true, hasFactura: true, allocations: { select: { packId: true, amount: true } } },
    }),
    prisma.mLOrder.findMany({
      where: { shippingStatus: { in: ["RETURNED", "NOT_DELIVERED"] }, dateCreated: { gte: dateGte, lte: dateLte } },
      select: { mlOrderId: true, mlItemId: true, returnShipCost: true },
    }),
    prisma.pack.findMany({
      select: {
        id: true,
        items: {
          select: {
            quantity: true,
            productVariant: { select: { product: { select: { unitCost: true } } } },
          },
        },
      },
    }),
    prisma.mLListing.findMany({
      select: { mlItemId: true, packId: true },
    }),
  ]);

  // Build maps
  const packToGroupMap = new Map<string, string>();
  const productToGroupMap = new Map<string, string>();
  const groupInfoMap = new Map<string, { name: string; color: string }>();

  for (const group of groups) {
    groupInfoMap.set(group.id, { name: group.name, color: group.color });
    for (const item of group.items) {
      productToGroupMap.set(item.product.id, group.id);
      for (const variant of item.product.variants) {
        for (const pi of variant.packItems) {
          if (!packToGroupMap.has(pi.packId)) {
            packToGroupMap.set(pi.packId, group.id);
          }
        }
      }
    }
  }

  const listingToPackMap = new Map(listings.map((l) => [l.mlItemId, l.packId]));

  const packCostMap = new Map<string, number>();
  for (const pack of packsWithCosts) {
    const cost = pack.items.reduce(
      (sum, item) => sum + item.quantity * Number(item.productVariant.product.unitCost),
      0
    );
    if (cost > 0) packCostMap.set(pack.id, cost);
  }

  // Resolve expense transactionIds → packIds
  const allTxIdsFromExpenses = new Set<string>();
  for (const exp of expenses) {
    if (exp.transactionIds) {
      exp.transactionIds.split(",").filter(Boolean).forEach((id) => allTxIdsFromExpenses.add(id));
    }
  }
  const txToPackMap = new Map<string, string>();
  if (allTxIdsFromExpenses.size > 0) {
    const linkedTxs = await prisma.mPTransaction.findMany({
      where: { id: { in: [...allTxIdsFromExpenses] } },
      select: { id: true, packId: true },
    });
    for (const ltx of linkedTxs) {
      if (ltx.packId) txToPackMap.set(ltx.id, ltx.packId);
    }
  }

  // Initialize group accumulators
  const NONE = "__none__";
  const accs = new Map<string, GroupAccounting>();

  function getAcc(groupId: string | null): GroupAccounting {
    const key = groupId || NONE;
    if (!accs.has(key)) {
      const info = groupId ? groupInfoMap.get(groupId) : null;
      accs.set(key, {
        groupId: groupId,
        groupName: info?.name || "Sin grupo",
        groupColor: info?.color || "#9ca3af",
        ingresos: 0, comisiones: 0, envios: 0, impuestos: 0,
        costoProducto: 0, gastos: 0, compras: 0, flex: 0,
        devoluciones: 0, utilidad: 0, retiros: 0, saldo: 0,
        salesCount: 0,
      });
    }
    return accs.get(key)!;
  }

  // Aggregate transactions
  const returnedOrderIds = new Set(returnedOrders.map((o) => o.mlOrderId));
  const salesPerPackPerGroup = new Map<string, Map<string, number>>();

  for (const tx of allTransactions) {
    if (tx.mlOrderId && returnedOrderIds.has(tx.mlOrderId)) continue;

    const groupId = tx.packId ? (packToGroupMap.get(tx.packId) || null) : null;
    const acc = getAcc(groupId);
    const amount = Number(tx.amount);

    if (tx.label === "sale") {
      acc.ingresos += amount;
      acc.salesCount += tx.quantity;
      if (tx.packId) {
        const key = groupId || NONE;
        if (!salesPerPackPerGroup.has(key)) salesPerPackPerGroup.set(key, new Map());
        const packSales = salesPerPackPerGroup.get(key)!;
        packSales.set(tx.packId, (packSales.get(tx.packId) || 0) + tx.quantity);
      }
    } else if (tx.label === "fee" || tx.label === "commission") {
      acc.comisiones += Math.abs(amount);
    } else if (tx.label === "shipping") {
      acc.envios += Math.abs(amount);
    } else if (tx.label === "flex_cost") {
      acc.flex += Math.abs(amount);
    } else if (tx.label === "flex_bonificacion") {
      acc.flex -= amount;
    }
  }

  // Product cost per group
  for (const [key, packSales] of salesPerPackPerGroup) {
    const acc = accs.get(key);
    if (!acc) continue;
    for (const [packId, qty] of packSales) {
      acc.costoProducto += (packCostMap.get(packId) || 0) * qty;
    }
  }

  // Aggregate expenses
  for (const exp of expenses) {
    let groupId: string | null = null;
    if (exp.productGroupId) {
      groupId = exp.productGroupId;
    } else if (exp.packId) {
      groupId = packToGroupMap.get(exp.packId) || null;
    } else if (exp.productId) {
      groupId = productToGroupMap.get(exp.productId) || null;
    } else if (exp.transactionIds) {
      const txIds = exp.transactionIds.split(",").filter(Boolean);
      for (const txId of txIds) {
        const pId = txToPackMap.get(txId);
        if (pId) { groupId = packToGroupMap.get(pId) || null; break; }
      }
    }

    const acc = getAcc(groupId);
    const amt = Number(exp.amount);
    if (exp.type === "compra") {
      acc.compras += amt;
    } else {
      acc.gastos += amt;
    }
  }

  // Aggregate withdrawals
  for (const w of withdrawals) {
    const amt = Number(w.amount);
    if (w.productGroupId) {
      getAcc(w.productGroupId).retiros += amt;
    } else if (w.allocations.length > 0) {
      for (const alloc of w.allocations) {
        if (alloc.packId) {
          const gId = packToGroupMap.get(alloc.packId) || null;
          getAcc(gId).retiros += Number(alloc.amount);
        }
      }
    } else {
      getAcc(null).retiros += amt;
    }
  }

  // Aggregate return shipping costs
  for (const ro of returnedOrders) {
    const packId = ro.mlItemId ? listingToPackMap.get(ro.mlItemId) : null;
    const groupId = packId ? (packToGroupMap.get(packId) || null) : null;
    getAcc(groupId).devoluciones += Number(ro.returnShipCost || 0);
  }

  // Calculate derived fields
  for (const acc of accs.values()) {
    acc.impuestos = (acc.ingresos / 1.16) * 0.105;
    acc.utilidad = acc.ingresos - acc.comisiones - acc.envios - acc.impuestos - acc.costoProducto - acc.gastos - acc.compras - acc.flex - acc.devoluciones;
    acc.saldo = acc.utilidad - acc.retiros;
  }

  // Sort: named groups first, then "Sin grupo"
  const rows = [...accs.values()].sort((a, b) => {
    if (a.groupId === null) return 1;
    if (b.groupId === null) return -1;
    return b.ingresos - a.ingresos;
  });

  // Summary totals
  const totals = rows.reduce(
    (t, r) => ({
      ingresos: t.ingresos + r.ingresos,
      comisiones: t.comisiones + r.comisiones,
      envios: t.envios + r.envios,
      impuestos: t.impuestos + r.impuestos,
      costoProducto: t.costoProducto + r.costoProducto,
      gastos: t.gastos + r.gastos,
      compras: t.compras + r.compras,
      flex: t.flex + r.flex,
      devoluciones: t.devoluciones + r.devoluciones,
      utilidad: t.utilidad + r.utilidad,
      retiros: t.retiros + r.retiros,
      saldo: t.saldo + r.saldo,
      salesCount: t.salesCount + r.salesCount,
    }),
    { ingresos: 0, comisiones: 0, envios: 0, impuestos: 0, costoProducto: 0, gastos: 0, compras: 0, flex: 0, devoluciones: 0, utilidad: 0, retiros: 0, saldo: 0, salesCount: 0 }
  );

  const totalDeducciones = totals.comisiones + totals.envios + totals.impuestos + totals.costoProducto + totals.gastos + totals.compras + totals.flex + totals.devoluciones;

  // Build productToGroupMap for client-side ads
  const productToGroupMapObj: Record<string, string> = {};
  for (const [pid, gid] of productToGroupMap) {
    productToGroupMapObj[pid] = gid;
  }

  const groupsForAds = rows.map((r) => ({
    groupId: r.groupId || "__none__",
    groupName: r.groupName,
    groupColor: r.groupColor,
    utilidad: r.utilidad,
    retiros: r.retiros,
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Contabilidad"
        description="Conciliacion financiera por grupo"
      />

      <ContabilidadFilters />

      {/* Explanation */}
      <div className="rounded-[9px] border border-border bg-muted/30 p-4 text-[12px] text-muted-foreground space-y-1">
        <p className="font-medium text-foreground text-[13px]">Como leer esta pagina</p>
        <p><strong>Utilidad</strong> = Ingresos - todas las deducciones (comisiones, envios, impuestos, costo de producto, gastos, flex, devoluciones)</p>
        <p><strong>Saldo</strong> = Utilidad - Retiros. Si es $0 o cercano, las cuentas estan cuadradas. Si es positivo, hay dinero por retirar. Si es negativo, se retiro de mas.</p>
        <p><span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-600" /> = cuadrado (diferencia menor a $100)</span> <span className="inline-flex items-center gap-1 ml-3"><AlertTriangle className="h-3 w-3 text-amber-500" /> = descuadre (falta retirar o se retiro de mas)</span></p>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[9px] border border-border bg-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Total Vendido</p>
          <p className="text-xl font-bold num margin-good">{formatCurrency(totals.ingresos)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">{totals.salesCount} ventas · {rows.length} grupos</p>
        </div>
        <div className="rounded-[9px] border border-border bg-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Total Deducciones</p>
          <p className="text-xl font-bold num margin-bad">-{formatCurrency(totalDeducciones)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Comisiones, envios, impuestos, costos, gastos, flex, devoluciones
          </p>
        </div>
        <div className="rounded-[9px] border border-border bg-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Ganancia Real</p>
          <p className={`text-xl font-bold num ${totals.utilidad >= 0 ? "margin-good" : "margin-bad"}`}>{formatCurrency(totals.utilidad)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Lo que queda despues de TODO (sin ads)
          </p>
        </div>
        <div className="rounded-[9px] border border-border bg-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
            {totals.saldo >= 0 ? "Falta Retirar" : "Retirado de Mas"}
          </p>
          <p className={`text-xl font-bold num ${Math.abs(totals.saldo) < 100 ? "margin-good" : totals.saldo > 0 ? "margin-good" : "margin-bad"}`}>
            {formatCurrency(Math.abs(totals.saldo))}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Ganancia {formatCurrency(totals.utilidad)} - Retirado {formatCurrency(totals.retiros)}
            {Math.abs(totals.saldo) < 100 ? " = Cuadrado" : ""}
          </p>
        </div>
      </div>

      {/* Ads Integration */}
      <ContabilidadAds
        dateFrom={dateFrom}
        dateTo={dateTo}
        productToGroupMap={productToGroupMapObj}
        groups={groupsForAds}
      />

      {/* Reconciliation Table */}
      <div className="rounded-[9px] border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-[13px] font-semibold">Detalle por Grupo de Productos</p>
          <p className="text-[11px] text-muted-foreground">
            {dateFrom} al {dateTo} · Cada fila = un grupo de productos · Saldo = lo que queda despues de retirar
          </p>
        </div>

        <div className="overflow-x-auto">
          <Table className="min-w-[1100px]">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-[10px] uppercase tracking-wider">Grupo</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider">Ventas</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider">Ingresos</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider">Comis.</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider">Envios</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider">Impuestos</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider">Costo</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider">Gastos</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider">Flex</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider">Devol.</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider font-semibold">Utilidad</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider">Retiros</TableHead>
                <TableHead className="text-right text-[10px] uppercase tracking-wider font-semibold">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const isBalanced = Math.abs(row.saldo) < 100;
                return (
                  <TableRow key={row.groupId || "none"} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: row.groupColor }}
                        />
                        <Link
                          href={`/flujo-caja?dateFrom=${dateFrom}&dateTo=${dateTo}`}
                          className="font-medium text-[12.5px] hover:underline"
                        >
                          {row.groupName}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell className="text-right num text-[12px] text-muted-foreground">{row.salesCount}</TableCell>
                    <TableCell className="text-right num text-[12px] font-medium margin-good">{formatCurrency(row.ingresos)}</TableCell>
                    <NumCell value={row.comisiones} />
                    <NumCell value={row.envios} />
                    <NumCell value={row.impuestos} />
                    <NumCell value={row.costoProducto} />
                    <NumCell value={row.gastos + row.compras} />
                    <NumCell value={row.flex} />
                    <NumCell value={row.devoluciones} />
                    <TableCell className={`text-right num text-[12px] font-semibold ${row.utilidad >= 0 ? "margin-good" : "margin-bad"}`}>
                      {formatCurrency(row.utilidad)}
                    </TableCell>
                    <TableCell className="text-right num text-[12px] font-medium">
                      {row.retiros !== 0 ? (
                        <span className={row.retiros > 0 ? "margin-bad" : "margin-good"}>
                          {row.retiros > 0 ? "-" : "+"}{formatCurrency(Math.abs(row.retiros))}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isBalanced ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        )}
                        <span className={`num text-[12px] font-semibold ${isBalanced ? "margin-good" : "margin-bad"}`}>
                          {formatCurrency(row.saldo)}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}

              {/* Total Row */}
              <TableRow className="bg-muted/30 border-t-2 border-border font-semibold">
                <TableCell className="font-semibold text-[12.5px]">Total</TableCell>
                <TableCell className="text-right num text-[12px]">{totals.salesCount}</TableCell>
                <TableCell className="text-right num text-[12px] margin-good">{formatCurrency(totals.ingresos)}</TableCell>
                <NumCell value={totals.comisiones} bold />
                <NumCell value={totals.envios} bold />
                <NumCell value={totals.impuestos} bold />
                <NumCell value={totals.costoProducto} bold />
                <NumCell value={totals.gastos + totals.compras} bold />
                <NumCell value={totals.flex} bold />
                <NumCell value={totals.devoluciones} bold />
                <TableCell className={`text-right num text-[12px] font-bold ${totals.utilidad >= 0 ? "margin-good" : "margin-bad"}`}>
                  {formatCurrency(totals.utilidad)}
                </TableCell>
                <TableCell className="text-right num text-[12px] font-bold">
                  {totals.retiros !== 0 ? (
                    <span className={totals.retiros > 0 ? "margin-bad" : "margin-good"}>
                      {totals.retiros > 0 ? "-" : "+"}{formatCurrency(Math.abs(totals.retiros))}
                    </span>
                  ) : "-"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {Math.abs(totals.saldo) < 100 ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    )}
                    <span className={`num text-[12px] font-bold ${Math.abs(totals.saldo) < 100 ? "margin-good" : "margin-bad"}`}>
                      {formatCurrency(totals.saldo)}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function NumCell({ value, bold }: { value: number; bold?: boolean }) {
  if (value === 0) {
    return <TableCell className="text-right num text-[12px] text-muted-foreground">-</TableCell>;
  }
  return (
    <TableCell className={`text-right num text-[12px] margin-bad ${bold ? "font-bold" : ""}`}>
      -{formatCurrency(value)}
    </TableCell>
  );
}
