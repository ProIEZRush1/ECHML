export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Receipt } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ExpenseCreateButton } from "@/components/expenses/expense-create-button";
import { ExpenseDeleteButton } from "@/components/expenses/expense-delete-button";
import { ExpenseEditButton } from "@/components/expenses/expense-edit-button";
import { AccountFilter } from "@/components/accounts/account-filter";

const CATEGORY_CSS: Record<string, { label: string; cls: string }> = {
  proveedor: { label: "Proveedor", cls: "tx-pill fee" },
  envio: { label: "Envio", cls: "tx-pill shipping" },
  suscripcion: { label: "Suscripcion", cls: "tx-pill tax" },
  publicidad: { label: "Publicidad", cls: "tx-pill sale" },
  empaque: { label: "Empaque", cls: "tx-pill flex" },
  otro: { label: "Otro", cls: "tx-pill expense" },
};

export default async function GastosPage({
  searchParams,
}: {
  searchParams: Promise<{ accountId?: string }>;
}) {
  const params = await searchParams;

  const where = params.accountId ? { accountId: params.accountId } : {};

  const [expenses, accounts] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: {
        supplier: { select: { name: true } },
        product: { select: { name: true } },
        pack: { select: { sku: true, name: true } },
        productGroup: { select: { name: true } },
        account: { select: { name: true, color: true } },
      },
      orderBy: { date: "desc" },
    }),
    prisma.account.findMany({
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader title="Gastos" description="Registro de gastos operativos">
        <ExpenseCreateButton />
      </PageHeader>

      <AccountFilter accounts={accounts} basePath="/gastos" />

      {expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Sin gastos registrados"
          description="Los gastos operativos apareceran aqui cuando los registres."
        />
      ) : (
        <div className="rounded-xl border border-border bg-card glass overflow-x-auto">
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-[11px] uppercase tracking-wider">Fecha</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Tipo</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider">Monto</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Categoria</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Concepto</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Cuenta</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider hidden sm:table-cell">Asignado a</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => {
                const catConfig = CATEGORY_CSS[expense.category] || CATEGORY_CSS.otro;
                return (
                  <TableRow key={expense.id} className="hover:bg-muted/50">
                    <TableCell className="text-[12.5px] text-muted-foreground whitespace-nowrap">
                      {formatDate(expense.date)}
                    </TableCell>
                    <TableCell>
                      <span className={expense.type === "compra" ? "tx-pill withdraw" : expense.type === "registro" ? "tx-pill tax" : "tx-pill expense"}>
                        {expense.type === "compra" ? "Compra" : expense.type === "registro" ? "Registro" : "Gasto"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right num font-semibold margin-bad">
                      -{formatCurrency(Number(expense.amount))}
                    </TableCell>
                    <TableCell>
                      <span className={catConfig.cls}>{catConfig.label}</span>
                    </TableCell>
                    <TableCell className="font-medium text-[12.5px]">
                      {expense.concept}
                    </TableCell>
                    <TableCell>
                      {expense.account ? (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: expense.account.color + "20", color: expense.account.color }}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: expense.account.color }} />
                          {expense.account.name}
                        </span>
                      ) : <span className="text-[11px] text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-[12.5px] text-muted-foreground hidden sm:table-cell">
                      {expense.product?.name || expense.pack?.name || expense.productGroup?.name || expense.supplier?.name || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <ExpenseEditButton
                          expense={{
                            id: expense.id,
                            type: expense.type,
                            amount: Number(expense.amount),
                            date: expense.date.toISOString(),
                            category: expense.category,
                            concept: expense.concept,
                            accountId: expense.accountId,
                          }}
                          accounts={accounts}
                        />
                        <ExpenseDeleteButton
                          expenseId={expense.id}
                          expenseConcept={expense.concept}
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
