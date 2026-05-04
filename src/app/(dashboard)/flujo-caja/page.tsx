export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  ArrowDownToLine,
  Receipt,
  Wallet,
  Activity,
  Percent,
  Truck,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { MPSyncButton } from "./mp-sync-button";

interface PackBalance {
  id: string;
  sku: string;
  name: string;
  income: number;
  fees: number;
  netIncome: number;
  withdrawn: number;
  net: number;
}

interface RecentTransaction {
  type: "income" | "withdrawal" | "expense" | "fee" | "mp_movement";
  date: Date;
  amount: number;
  description: string;
  label?: string;
}

export default async function FlujoCajaPage() {
  const [orders, withdrawals, expenses, listings, mpTransactions] = await Promise.all([
    prisma.mLOrder.findMany({
      select: {
        id: true,
        mlItemId: true,
        totalAmount: true,
        dateCreated: true,
      },
      orderBy: { dateCreated: "desc" },
    }),
    prisma.withdrawal.findMany({
      include: {
        allocations: {
          include: {
            pack: { select: { id: true, sku: true, name: true } },
          },
        },
      },
      orderBy: { date: "desc" },
    }),
    prisma.expense.findMany({
      orderBy: { date: "desc" },
    }),
    prisma.mLListing.findMany({
      select: {
        mlItemId: true,
        packId: true,
        pack: { select: { id: true, sku: true, name: true } },
      },
    }),
    prisma.mPTransaction.findMany({
      orderBy: { dateCreated: "desc" },
    }),
  ]);

  const hasMPData = mpTransactions.length > 0;

  // Build mlItemId -> Pack mapping
  const itemToPackMap = new Map<string, { id: string; sku: string; name: string }>();
  for (const listing of listings) {
    itemToPackMap.set(listing.mlItemId, listing.pack);
  }

  // Calculate income per pack
  const incomeByPack = new Map<string, number>();
  const feesByPack = new Map<string, number>();
  let totalIncome = 0;
  let totalFees = 0;
  let totalShippingFees = 0;

  if (hasMPData) {
    for (const tx of mpTransactions) {
      const amount = Number(tx.amount);
      const label = tx.label;

      if (label === "sale") {
        totalIncome += amount;
        if (tx.packId) {
          incomeByPack.set(tx.packId, (incomeByPack.get(tx.packId) || 0) + amount);
        }
      }

      if (label === "fee" || label === "commission") {
        totalFees += Math.abs(amount);
        if (tx.packId) {
          feesByPack.set(tx.packId, (feesByPack.get(tx.packId) || 0) + Math.abs(amount));
        }
      }

      if (label === "shipping") {
        totalShippingFees += Math.abs(amount);
      }
    }
  } else {
    for (const order of orders) {
      const amount = Number(order.totalAmount);
      totalIncome += amount;

      const pack = itemToPackMap.get(order.mlItemId);
      if (pack) {
        incomeByPack.set(pack.id, (incomeByPack.get(pack.id) || 0) + amount);
      }
    }
  }

  const totalWithdrawn = withdrawals.reduce((sum, w) => sum + Number(w.amount), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const mpBalance = totalIncome - totalWithdrawn - totalFees - totalShippingFees;

  // Calculate withdrawals per pack
  const withdrawnByPack = new Map<string, number>();
  for (const withdrawal of withdrawals) {
    for (const alloc of withdrawal.allocations) {
      if (alloc.packId) {
        withdrawnByPack.set(
          alloc.packId,
          (withdrawnByPack.get(alloc.packId) || 0) + Number(alloc.amount)
        );
      }
    }
  }

  // Build pack balances
  const packIds = new Set<string>();
  for (const [packId] of incomeByPack) packIds.add(packId);
  for (const [packId] of withdrawnByPack) packIds.add(packId);

  const packBalances: PackBalance[] = [];
  const seenPacks = new Set<string>();

  for (const listing of listings) {
    if (!packIds.has(listing.pack.id)) continue;
    if (seenPacks.has(listing.pack.id)) continue;
    seenPacks.add(listing.pack.id);

    const income = incomeByPack.get(listing.pack.id) || 0;
    const fees = feesByPack.get(listing.pack.id) || 0;
    const withdrawn = withdrawnByPack.get(listing.pack.id) || 0;
    const netIncome = income - fees;

    packBalances.push({
      id: listing.pack.id,
      sku: listing.pack.sku,
      name: listing.pack.name,
      income,
      fees,
      netIncome,
      withdrawn,
      net: netIncome - withdrawn,
    });
  }

  packBalances.sort((a, b) => b.income - a.income);

  // Build recent transactions
  const recentTransactions: RecentTransaction[] = [];

  if (hasMPData) {
    for (const tx of mpTransactions.slice(0, 30)) {
      const amount = Number(tx.amount);
      const label = tx.label;

      let type: RecentTransaction["type"] = "mp_movement";
      if (label === "sale") type = "income";
      else if (label === "fee" || label === "commission") type = "fee";

      recentTransactions.push({
        type,
        date: tx.dateCreated,
        amount: tx.type === "debit" ? -Math.abs(amount) : amount,
        description: tx.description || `Movimiento MP: ${label}`,
        label,
      });
    }
  } else {
    for (const order of orders.slice(0, 15)) {
      const pack = itemToPackMap.get(order.mlItemId);
      recentTransactions.push({
        type: "income",
        date: order.dateCreated,
        amount: Number(order.totalAmount),
        description: pack ? `Venta ${pack.sku}` : `Venta ${order.mlItemId}`,
      });
    }
  }

  for (const withdrawal of withdrawals.slice(0, 10)) {
    recentTransactions.push({
      type: "withdrawal",
      date: withdrawal.date,
      amount: Number(withdrawal.amount),
      description: withdrawal.concept,
    });
  }

  for (const expense of expenses.slice(0, 10)) {
    recentTransactions.push({
      type: "expense",
      date: expense.date,
      amount: Number(expense.amount),
      description: `[${expense.category}] ${expense.concept}`,
    });
  }

  recentTransactions.sort((a, b) => b.date.getTime() - a.date.getTime());
  const last20Transactions = recentTransactions.slice(0, 20);

  // KPI cards
  const kpis = [
    {
      title: "Ingresos Totales",
      value: formatCurrency(totalIncome),
      icon: TrendingUp,
      iconBg: "bg-green-100 dark:bg-green-900/30",
      iconColor: "text-green-600 dark:text-green-400",
      valueColor: "text-green-600 dark:text-green-400",
    },
    {
      title: "Retirado",
      value: formatCurrency(totalWithdrawn),
      icon: ArrowDownToLine,
      iconBg: "bg-red-100 dark:bg-red-900/30",
      iconColor: "text-red-600 dark:text-red-400",
      valueColor: "text-red-600 dark:text-red-400",
    },
    {
      title: "Gastos",
      value: formatCurrency(totalExpenses),
      icon: Receipt,
      iconBg: "bg-amber-100 dark:bg-amber-900/30",
      iconColor: "text-amber-600 dark:text-amber-400",
      valueColor: "text-amber-600 dark:text-amber-400",
    },
    {
      title: "Balance en MP",
      value: formatCurrency(mpBalance),
      icon: Wallet,
      iconBg: "bg-blue-100 dark:bg-blue-900/30",
      iconColor: "text-blue-600 dark:text-blue-400",
      valueColor: "text-blue-600 dark:text-blue-400",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Flujo de Caja"
          description="Balance y movimientos financieros"
        />
        <MPSyncButton />
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.title}
              </CardTitle>
              <div className={`rounded-md p-2 ${kpi.iconBg}`}>
                <kpi.icon className={`h-4 w-4 ${kpi.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${kpi.valueColor}`}>
                {kpi.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Fee Breakdown — only show if MP data exists */}
      {hasMPData && (totalFees > 0 || totalShippingFees > 0) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Comisiones ML
              </CardTitle>
              <div className="rounded-md p-2 bg-purple-100 dark:bg-purple-900/30">
                <Percent className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                {formatCurrency(totalFees)}
              </div>
              {totalIncome > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {((totalFees / totalIncome) * 100).toFixed(1)}% de ingresos
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Costos de Envio
              </CardTitle>
              <div className="rounded-md p-2 bg-orange-100 dark:bg-orange-900/30">
                <Truck className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
                {formatCurrency(totalShippingFees)}
              </div>
              {totalIncome > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {((totalShippingFees / totalIncome) * 100).toFixed(1)}% de ingresos
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ingreso Neto
              </CardTitle>
              <div className="rounded-md p-2 bg-emerald-100 dark:bg-emerald-900/30">
                <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(totalIncome - totalFees - totalShippingFees)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Despues de comisiones y envios
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* MP Sync Status */}
      {hasMPData && (
        <p className="text-xs text-muted-foreground">
          Datos de Mercado Pago sincronizados ({mpTransactions.length} movimientos)
        </p>
      )}

      {/* Balance por Pack */}
      {packBalances.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">Balance por Pack</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {packBalances.map((pack) => {
              const ratio = pack.netIncome > 0 ? (pack.withdrawn / pack.netIncome) * 100 : 0;
              const isPositive = pack.net >= 0;

              return (
                <Card key={pack.id}>
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{pack.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{pack.sku}</p>
                        </div>
                        <div className={`text-lg font-bold ${isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                          {formatCurrency(pack.net)}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Ingresos</span>
                          <span className="font-medium text-green-600 dark:text-green-400">
                            {formatCurrency(pack.income)}
                          </span>
                        </div>
                        {hasMPData && pack.fees > 0 && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Comisiones</span>
                            <span className="font-medium text-purple-600 dark:text-purple-400">
                              -{formatCurrency(pack.fees)}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Retirado</span>
                          <span className="font-medium text-red-600 dark:text-red-400">
                            {formatCurrency(pack.withdrawn)}
                          </span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-red-500 dark:bg-red-400 transition-all"
                          style={{ width: `${Math.min(ratio, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-right">
                        {ratio.toFixed(0)}% retirado
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Movimientos Recientes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            Movimientos Recientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {last20Transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No hay movimientos registrados.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descripcion</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {last20Transactions.map((tx, i) => (
                  <TableRow key={i} className="hover:bg-muted/50">
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(tx.date)}
                    </TableCell>
                    <TableCell>
                      {tx.type === "income" && (
                        <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-100">
                          Venta
                        </Badge>
                      )}
                      {tx.type === "withdrawal" && (
                        <Badge variant="default" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 hover:bg-red-100">
                          Retiro
                        </Badge>
                      )}
                      {tx.type === "expense" && (
                        <Badge variant="default" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 hover:bg-amber-100">
                          Gasto
                        </Badge>
                      )}
                      {tx.type === "fee" && (
                        <Badge variant="default" className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 hover:bg-purple-100">
                          Comision
                        </Badge>
                      )}
                      {tx.type === "mp_movement" && (
                        <Badge variant="default" className="bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300 hover:bg-slate-100">
                          MP
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {tx.description}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <span
                        className={
                          tx.amount >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }
                      >
                        {tx.amount >= 0 ? "+" : ""}
                        {formatCurrency(Math.abs(tx.amount))}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
