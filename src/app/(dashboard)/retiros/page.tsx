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
import { WithdrawalGroupSelect } from "./withdrawal-group-select";

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

export default async function RetirosPage() {
  const [withdrawals, groups] = await Promise.all([
    prisma.withdrawal.findMany({
      include: {
        allocations: {
          include: {
            pack: { select: { sku: true, name: true } },
          },
        },
        productGroup: { select: { id: true, name: true, color: true } },
      },
      orderBy: { date: "desc" },
    }),
    prisma.productGroup.findMany({
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

      {withdrawals.length === 0 ? (
        <EmptyState
          icon={ArrowDownToLine}
          title="Sin retiros registrados"
          description="Los retiros de Mercado Pago apareceran aqui cuando los registres."
        />
      ) : (
        <div className="rounded-[9px] border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-[11px] uppercase tracking-wider">Fecha</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider">Monto</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Concepto</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Metodo</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Asignacion</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {withdrawals.map((withdrawal) => {
                const allocationSummary = withdrawal.allocations
                  .filter((a) => a.pack)
                  .map(
                    (a) =>
                      `${a.pack!.sku}: ${formatCurrency(Number(a.amount))}`
                  );

                return (
                  <TableRow key={withdrawal.id} className="hover:bg-muted/50">
                    <TableCell className="text-[12.5px] text-muted-foreground whitespace-nowrap">
                      {formatDate(withdrawal.date)}
                    </TableCell>
                    <TableCell className="text-right num font-semibold margin-bad">
                      -{formatCurrency(Number(withdrawal.amount))}
                    </TableCell>
                    <TableCell className="font-medium text-[12.5px]">
                      {withdrawal.concept}
                    </TableCell>
                    <TableCell>
                      <span className={METHOD_CSS[withdrawal.method] || "tx-pill withdraw"}>
                        {METHOD_LABELS[withdrawal.method] || withdrawal.method}
                      </span>
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
                      <div className="flex items-center justify-end gap-1">
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
