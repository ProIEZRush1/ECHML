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
import { ArrowDownToLine } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { WithdrawalCreateButton } from "@/components/withdrawals/withdrawal-create-button";
import { WithdrawalDeleteButton } from "@/components/withdrawals/withdrawal-delete-button";
import { WithdrawalEditButton } from "@/components/withdrawals/withdrawal-edit-button";
import { WithdrawalGroupSelect } from "./withdrawal-group-select";
import { WithdrawalFacturaToggle } from "./withdrawal-factura-toggle";
import { AccountFilter } from "@/components/accounts/account-filter";

const METHOD_CSS: Record<string, string> = {
  bank: "tx-pill withdraw",
  cash: "tx-pill sale",
  provider: "tx-pill shipping",
};

const METHOD_LABELS: Record<string, string> = {
  bank: "Banco",
  cash: "Efectivo",
  provider: "Proveedor",
};

export default async function RetirosPage({
  searchParams,
}: {
  searchParams: Promise<{ accountId?: string }>;
}) {
  const params = await searchParams;

  const withdrawalWhere = params.accountId
    ? { OR: [{ accountId: params.accountId }, { toAccountId: params.accountId }] }
    : {};

  const [withdrawals, groups, accounts] = await Promise.all([
    prisma.withdrawal.findMany({
      where: withdrawalWhere,
      include: {
        allocations: {
          include: {
            pack: { select: { sku: true, name: true } },
            product: { select: { name: true, supplierCode: true } },
          },
        },
        productGroup: { select: { id: true, name: true, color: true } },
        fromAccount: { select: { id: true, name: true, color: true } },
        toAccount: { select: { id: true, name: true, color: true } },
      },
      orderBy: { date: "desc" },
    }),
    prisma.productGroup.findMany({
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
    prisma.account.findMany({
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Retiros"
        description="Registro de retiros de Mercado Pago"
      >
        <WithdrawalCreateButton />
      </PageHeader>

      <AccountFilter accounts={accounts} basePath="/retiros" />

      {withdrawals.length === 0 ? (
        <EmptyState
          icon={ArrowDownToLine}
          title="Sin retiros registrados"
          description="Los retiros de Mercado Pago apareceran aqui cuando los registres."
        />
      ) : (
        <div className="rounded-[9px] border border-border bg-card overflow-x-auto">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-[11px] uppercase tracking-wider">Fecha</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider">Monto</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Concepto</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Metodo</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Cuenta</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Asignacion</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {withdrawals.map((withdrawal) => {
                const allocationSummary = withdrawal.allocations
                  .filter((a) => a.pack || a.product)
                  .map((a) => {
                    if (a.pack) return `${a.pack.sku}: ${formatCurrency(Number(a.amount))}`;
                    if (a.product) return `${a.product.supplierCode || a.product.name}: ${formatCurrency(Number(a.amount))}`;
                    return "";
                  })
                  .filter(Boolean);

                return (
                  <TableRow key={withdrawal.id} className="hover:bg-muted/50">
                    <TableCell className="text-[12.5px] text-muted-foreground whitespace-nowrap">
                      {formatDate(withdrawal.date)}
                    </TableCell>
                    <TableCell className={`text-right num font-semibold ${Number(withdrawal.amount) < 0 ? "margin-good" : "margin-bad"}`}>
                      {Number(withdrawal.amount) < 0 ? "+" : "-"}{formatCurrency(Math.abs(Number(withdrawal.amount)))}
                      {withdrawal.hasFactura && Number(withdrawal.amount) > 0 && (
                        <p className="text-[10px] text-muted-foreground">Factura: -{formatCurrency(Number(withdrawal.amount) * 0.03)}</p>
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-[12.5px]">
                      {withdrawal.concept}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className={METHOD_CSS[withdrawal.method] || "tx-pill withdraw"}>
                          {METHOD_LABELS[withdrawal.method] || withdrawal.method}
                        </span>
                        {withdrawal.hasFactura && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400">FACTURA</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        {withdrawal.fromAccount ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: withdrawal.fromAccount.color + "20", color: withdrawal.fromAccount.color }}>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: withdrawal.fromAccount.color }} />
                            {withdrawal.fromAccount.name}
                          </span>
                        ) : null}
                        {withdrawal.fromAccount && withdrawal.toAccount && <span className="text-[10px] text-muted-foreground">→</span>}
                        {withdrawal.toAccount ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: withdrawal.toAccount.color + "20", color: withdrawal.toAccount.color }}>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: withdrawal.toAccount.color }} />
                            {withdrawal.toAccount.name}
                          </span>
                        ) : null}
                        {!withdrawal.fromAccount && !withdrawal.toAccount && <span className="text-[11px] text-muted-foreground">-</span>}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[250px]">
                      {withdrawal.productGroup ? (
                        <span
                          className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full"
                          style={{ background: `${withdrawal.productGroup.color}20`, color: withdrawal.productGroup.color }}
                        >
                          <span className="h-2 w-2 rounded-full" style={{ background: withdrawal.productGroup.color }} />
                          {withdrawal.productGroup.name}
                        </span>
                      ) : allocationSummary.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {allocationSummary.map((s, i) => (
                            <span key={i} className="filt-input text-[10.5px]">{s}</span>
                          ))}
                        </div>
                      ) : (
                        <WithdrawalGroupSelect
                          withdrawalId={withdrawal.id}
                          currentGroupId={null}
                          groups={groups}
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <WithdrawalEditButton
                          withdrawal={{
                            id: withdrawal.id,
                            amount: Number(withdrawal.amount),
                            date: withdrawal.date.toISOString(),
                            concept: withdrawal.concept,
                            method: withdrawal.method,
                            hasFactura: withdrawal.hasFactura,
                            accountId: withdrawal.accountId,
                            toAccountId: withdrawal.toAccountId,
                          }}
                        />
                        <WithdrawalFacturaToggle
                          withdrawalId={withdrawal.id}
                          hasFactura={withdrawal.hasFactura}
                        />
                        <WithdrawalGroupSelect
                          withdrawalId={withdrawal.id}
                          currentGroupId={withdrawal.productGroup?.id || null}
                          groups={groups}
                        />
                        <WithdrawalDeleteButton
                          withdrawalId={withdrawal.id}
                          withdrawalConcept={withdrawal.concept}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
