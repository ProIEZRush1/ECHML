export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Landmark, ArrowRight, Trash2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { AccountCreateButton } from "@/components/accounts/account-create-button";
import { TransferCreateButton } from "@/components/accounts/transfer-create-button";

export default async function CuentasPage() {
  const [accounts, transfers, expenses, withdrawals] = await Promise.all([
    prisma.account.findMany({ orderBy: { name: "asc" } }),
    prisma.accountTransfer.findMany({
      include: {
        fromAccount: { select: { name: true, color: true } },
        toAccount: { select: { name: true, color: true } },
      },
      orderBy: { date: "desc" },
      take: 50,
    }),
    prisma.expense.findMany({
      where: { accountId: { not: null } },
      select: { accountId: true, amount: true },
    }),
    prisma.withdrawal.findMany({
      where: { accountId: { not: null } },
      select: { accountId: true, amount: true },
    }),
  ]);

  const gastosByAccount = new Map<string, number>();
  for (const e of expenses) {
    if (!e.accountId) continue;
    gastosByAccount.set(e.accountId, (gastosByAccount.get(e.accountId) || 0) + Number(e.amount));
  }

  const retirosByAccount = new Map<string, number>();
  for (const w of withdrawals) {
    if (!w.accountId) continue;
    retirosByAccount.set(w.accountId, (retirosByAccount.get(w.accountId) || 0) + Number(w.amount));
  }

  const transfersIn = new Map<string, number>();
  const transfersOut = new Map<string, number>();
  for (const t of transfers) {
    const amt = Number(t.amount);
    const netAmt = t.hasFactura ? amt * 0.97 : amt;
    transfersOut.set(t.fromAccountId, (transfersOut.get(t.fromAccountId) || 0) + amt);
    transfersIn.set(t.toAccountId, (transfersIn.get(t.toAccountId) || 0) + netAmt);
  }

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
          {/* Account Balance Cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {accounts.map((account) => {
              const gastos = gastosByAccount.get(account.id) || 0;
              const retiros = retirosByAccount.get(account.id) || 0;
              const tIn = transfersIn.get(account.id) || 0;
              const tOut = transfersOut.get(account.id) || 0;
              return (
                <div key={account.id} className="rounded-[9px] border border-border bg-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="h-3 w-3 rounded-full" style={{ background: account.color }} />
                    <p className="text-[13px] font-semibold">{account.name}</p>
                    {account.isDefault && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">DEFAULT</span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {gastos > 0 && (
                      <div className="flex justify-between text-[11.5px]">
                        <span className="text-muted-foreground">Gastos</span>
                        <span className="num margin-bad">-{formatCurrency(gastos)}</span>
                      </div>
                    )}
                    {retiros > 0 && (
                      <div className="flex justify-between text-[11.5px]">
                        <span className="text-muted-foreground">Retiros</span>
                        <span className="num margin-bad">-{formatCurrency(retiros)}</span>
                      </div>
                    )}
                    {tIn > 0 && (
                      <div className="flex justify-between text-[11.5px]">
                        <span className="text-muted-foreground">Recibido</span>
                        <span className="num margin-good">+{formatCurrency(tIn)}</span>
                      </div>
                    )}
                    {tOut > 0 && (
                      <div className="flex justify-between text-[11.5px]">
                        <span className="text-muted-foreground">Enviado</span>
                        <span className="num margin-bad">-{formatCurrency(tOut)}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 pt-2 border-t border-border">
                    <div className="flex justify-between text-[12px] font-semibold">
                      <span className="text-muted-foreground">Total movimientos</span>
                      <span className="num">
                        {formatCurrency(gastos + retiros + tOut - tIn)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Transfers Table */}
          {transfers.length > 0 && (
            <div className="rounded-[9px] border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <p className="text-[13px] font-semibold">Pagos entre Cuentas</p>
                <p className="text-[11px] text-muted-foreground">{transfers.length} transferencias</p>
              </div>
              <div className="overflow-x-auto">
                <Table className="min-w-[500px]">
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-[11px] uppercase tracking-wider">Fecha</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">De → A</TableHead>
                      <TableHead className="text-right text-[11px] uppercase tracking-wider">Monto</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Concepto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfers.map((t) => (
                      <TableRow key={t.id} className="hover:bg-muted/50">
                        <TableCell className="text-[12px] text-muted-foreground whitespace-nowrap">
                          {formatDate(t.date)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-[12px]">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10.5px] font-medium" style={{ background: t.fromAccount.color + "20", color: t.fromAccount.color }}>
                              <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.fromAccount.color }} />
                              {t.fromAccount.name}
                            </span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10.5px] font-medium" style={{ background: t.toAccount.color + "20", color: t.toAccount.color }}>
                              <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.toAccount.color }} />
                              {t.toAccount.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right num font-medium text-[12px]">
                          {formatCurrency(Number(t.amount))}
                          {t.hasFactura && (
                            <p className="text-[9px] text-muted-foreground">Llega: {formatCurrency(Number(t.amount) * 0.97)}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-[12px]">
                          <div className="flex items-center gap-1.5">
                            {t.concept}
                            {t.hasFactura && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400">3%</span>
                            )}
                          </div>
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
