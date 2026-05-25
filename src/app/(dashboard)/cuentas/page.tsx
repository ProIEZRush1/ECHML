export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Landmark, ArrowRight, ArrowDownToLine, Receipt, ArrowLeftRight } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { AccountCreateButton } from "@/components/accounts/account-create-button";
import { TransferCreateButton } from "@/components/accounts/transfer-create-button";
import { AccountFilter } from "@/components/accounts/account-filter";

export default async function CuentasPage({
  searchParams,
}: {
  searchParams: Promise<{ accountId?: string }>;
}) {
  const params = await searchParams;
  const filterAccountId = params.accountId || null;

  const [accounts, transfers, expenses, withdrawals] = await Promise.all([
    prisma.account.findMany({ orderBy: { name: "asc" } }),
    prisma.accountTransfer.findMany({
      where: filterAccountId
        ? { OR: [{ fromAccountId: filterAccountId }, { toAccountId: filterAccountId }] }
        : {},
      include: {
        fromAccount: { select: { name: true, color: true } },
        toAccount: { select: { name: true, color: true } },
      },
      orderBy: { date: "desc" },
      take: 50,
    }),
    prisma.expense.findMany({
      where: filterAccountId ? { accountId: filterAccountId } : { accountId: { not: null } },
      select: { id: true, accountId: true, amount: true, concept: true, date: true, type: true, category: true },
      orderBy: { date: "desc" },
    }),
    prisma.withdrawal.findMany({
      where: filterAccountId
        ? { OR: [{ accountId: filterAccountId }, { toAccountId: filterAccountId }] }
        : { OR: [{ accountId: { not: null } }, { toAccountId: { not: null } }] },
      select: { id: true, accountId: true, toAccountId: true, amount: true, concept: true, date: true },
      orderBy: { date: "desc" },
    }),
  ]);

  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  // Aggregate for cards
  const gastosByAccount = new Map<string, number>();
  const gastosCountByAccount = new Map<string, number>();
  for (const e of expenses) {
    if (!e.accountId) continue;
    gastosByAccount.set(e.accountId, (gastosByAccount.get(e.accountId) || 0) + Number(e.amount));
    gastosCountByAccount.set(e.accountId, (gastosCountByAccount.get(e.accountId) || 0) + 1);
  }

  const retirosFromAccount = new Map<string, number>();
  const retirosToAccount = new Map<string, number>();
  const retirosCountFrom = new Map<string, number>();
  const retirosCountTo = new Map<string, number>();
  for (const w of withdrawals) {
    const amt = Math.abs(Number(w.amount));
    if (w.accountId) {
      retirosFromAccount.set(w.accountId, (retirosFromAccount.get(w.accountId) || 0) + amt);
      retirosCountFrom.set(w.accountId, (retirosCountFrom.get(w.accountId) || 0) + 1);
    }
    if (w.toAccountId) {
      retirosToAccount.set(w.toAccountId, (retirosToAccount.get(w.toAccountId) || 0) + amt);
      retirosCountTo.set(w.toAccountId, (retirosCountTo.get(w.toAccountId) || 0) + 1);
    }
  }

  const transfersIn = new Map<string, number>();
  const transfersOut = new Map<string, number>();
  for (const t of transfers) {
    const amt = Number(t.amount);
    const netAmt = t.hasFactura ? amt * 0.97 : amt;
    transfersOut.set(t.fromAccountId, (transfersOut.get(t.fromAccountId) || 0) + amt);
    transfersIn.set(t.toAccountId, (transfersIn.get(t.toAccountId) || 0) + netAmt);
  }

  // Build combined movements table
  type Movement = { id: string; date: Date; type: "gasto" | "retiro" | "transfer"; concept: string; amount: number; accountName: string; accountColor: string };
  const movements: Movement[] = [];

  for (const e of expenses) {
    const acc = e.accountId ? accountMap.get(e.accountId) : null;
    movements.push({
      id: `e-${e.id}`, date: e.date, type: "gasto",
      concept: e.concept, amount: Number(e.amount),
      accountName: acc?.name || "-", accountColor: acc?.color || "#6b7280",
    });
  }
  for (const w of withdrawals) {
    const fromAcc = w.accountId ? accountMap.get(w.accountId) : null;
    const toAcc = w.toAccountId ? accountMap.get(w.toAccountId) : null;
    movements.push({
      id: `w-${w.id}`, date: w.date, type: "retiro",
      concept: `${w.concept}${fromAcc && toAcc ? ` (${fromAcc.name} → ${toAcc.name})` : ""}`,
      amount: Math.abs(Number(w.amount)),
      accountName: fromAcc?.name || toAcc?.name || "-",
      accountColor: fromAcc?.color || toAcc?.color || "#6b7280",
    });
  }
  for (const t of transfers) {
    movements.push({
      id: `t-${t.id}`, date: t.date, type: "transfer",
      concept: t.concept, amount: Number(t.amount),
      accountName: `${t.fromAccount.name} → ${t.toAccount.name}`,
      accountColor: t.fromAccount.color,
    });
  }
  movements.sort((a, b) => b.date.getTime() - a.date.getTime());

  const displayAccounts = filterAccountId
    ? accounts.filter((a) => a.id === filterAccountId)
    : accounts;

  return (
    <div className="space-y-5">
      <PageHeader title="Cuentas" description="Balance y movimientos por cuenta bancaria">
        <div className="flex gap-2">
          <TransferCreateButton />
          <AccountCreateButton />
        </div>
      </PageHeader>

      {accounts.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="Sin cuentas registradas"
          description="Crea tu primera cuenta para empezar a rastrear gastos por banco."
        />
      ) : (
        <>
          <AccountFilter accounts={accounts} basePath="/cuentas" />

          {/* Account Balance Cards */}
          <div className={`grid gap-3 ${filterAccountId ? "" : "sm:grid-cols-2"}`}>
            {displayAccounts.map((account) => {
              const gastos = gastosByAccount.get(account.id) || 0;
              const gastosCount = gastosCountByAccount.get(account.id) || 0;
              const retirosSale = retirosFromAccount.get(account.id) || 0;
              const retirosRecibido = retirosToAccount.get(account.id) || 0;
              const retirosSaleCount = retirosCountFrom.get(account.id) || 0;
              const retirosRecibidoCount = retirosCountTo.get(account.id) || 0;
              const tIn = transfersIn.get(account.id) || 0;
              const tOut = transfersOut.get(account.id) || 0;
              const totalSalidas = gastos + retirosSale + tOut;
              const totalEntradas = retirosRecibido + tIn;

              return (
                <div key={account.id} className="rounded-[9px] border border-border bg-card overflow-hidden">
                  <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded-full" style={{ background: account.color }} />
                    <p className="text-[14px] font-semibold flex-1">{account.name}</p>
                    {account.isDefault && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">DEFAULT</span>
                    )}
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Salidas</p>
                      <div className="space-y-1">
                        {gastos > 0 && (
                          <div className="flex items-center justify-between text-[11.5px]">
                            <span className="flex items-center gap-1.5 text-muted-foreground"><Receipt className="h-3 w-3" />Gastos ({gastosCount})</span>
                            <span className="num margin-bad">-{formatCurrency(gastos)}</span>
                          </div>
                        )}
                        {retirosSale > 0 && (
                          <div className="flex items-center justify-between text-[11.5px]">
                            <span className="flex items-center gap-1.5 text-muted-foreground"><ArrowDownToLine className="h-3 w-3" />Retiros enviados ({retirosSaleCount})</span>
                            <span className="num margin-bad">-{formatCurrency(retirosSale)}</span>
                          </div>
                        )}
                        {tOut > 0 && (
                          <div className="flex items-center justify-between text-[11.5px]">
                            <span className="flex items-center gap-1.5 text-muted-foreground"><ArrowLeftRight className="h-3 w-3" />Transferido</span>
                            <span className="num margin-bad">-{formatCurrency(tOut)}</span>
                          </div>
                        )}
                        {totalSalidas === 0 && <p className="text-[11px] text-muted-foreground">Sin salidas</p>}
                      </div>
                    </div>
                    {totalEntradas > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Entradas</p>
                        <div className="space-y-1">
                          {retirosRecibido > 0 && (
                            <div className="flex items-center justify-between text-[11.5px]">
                              <span className="flex items-center gap-1.5 text-muted-foreground"><ArrowDownToLine className="h-3 w-3" />Retiros recibidos ({retirosRecibidoCount})</span>
                              <span className="num margin-good">+{formatCurrency(retirosRecibido)}</span>
                            </div>
                          )}
                          {tIn > 0 && (
                            <div className="flex items-center justify-between text-[11.5px]">
                              <span className="flex items-center gap-1.5 text-muted-foreground"><ArrowLeftRight className="h-3 w-3" />Recibido</span>
                              <span className="num margin-good">+{formatCurrency(tIn)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="pt-2 border-t border-border">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-semibold text-muted-foreground">Balance neto</span>
                        <span className={`num text-[14px] font-bold ${totalEntradas > totalSalidas ? "margin-good" : totalSalidas > 0 ? "margin-bad" : ""}`}>
                          {totalEntradas >= totalSalidas ? "+" : "-"}{formatCurrency(Math.abs(totalEntradas - totalSalidas))}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* All Movements Table */}
          {movements.length > 0 && (
            <div className="rounded-[9px] border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <p className="text-[13px] font-semibold">Todos los Movimientos</p>
                <p className="text-[11px] text-muted-foreground">
                  {expenses.length} gastos · {withdrawals.length} retiros · {transfers.length} transferencias
                </p>
              </div>
              <div className="overflow-x-auto">
                <Table className="min-w-[550px]">
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-[11px] uppercase tracking-wider">Fecha</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Tipo</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Concepto</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Cuenta</TableHead>
                      <TableHead className="text-right text-[11px] uppercase tracking-wider">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.slice(0, 100).map((m) => (
                      <TableRow key={m.id} className="hover:bg-muted/50">
                        <TableCell className="text-[12px] text-muted-foreground whitespace-nowrap">
                          {formatDate(m.date)}
                        </TableCell>
                        <TableCell>
                          <span className={m.type === "gasto" ? "tx-pill expense" : m.type === "retiro" ? "tx-pill withdraw" : "tx-pill sale"}>
                            {m.type === "gasto" ? "Gasto" : m.type === "retiro" ? "Retiro" : "Transfer"}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium text-[12px] max-w-[250px] truncate">
                          {m.concept}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: m.accountColor + "20", color: m.accountColor }}>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.accountColor }} />
                            {m.accountName}
                          </span>
                        </TableCell>
                        <TableCell className="text-right num font-medium text-[12px] margin-bad">
                          -{formatCurrency(m.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
