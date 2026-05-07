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
import { Receipt } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ExpenseCreateButton } from "@/components/expenses/expense-create-button";
import { ExpenseDeleteButton } from "@/components/expenses/expense-delete-button";

const CATEGORY_CSS: Record<string, { label: string; cls: string }> = {
  proveedor: { label: "Proveedor", cls: "tx-pill fee" },
  envio: { label: "Envio", cls: "tx-pill shipping" },
  suscripcion: { label: "Suscripcion", cls: "tx-pill tax" },
  publicidad: { label: "Publicidad", cls: "tx-pill sale" },
  empaque: { label: "Empaque", cls: "tx-pill flex" },
  otro: { label: "Otro", cls: "tx-pill expense" },
};

export default async function GastosPage() {
  const expenses = await prisma.expense.findMany({
    include: {
      supplier: { select: { name: true } },
      product: { select: { name: true } },
      pack: { select: { sku: true, name: true } },
      productGroup: { select: { name: true } },
    },
    orderBy: { date: "desc" },
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Gastos"
        description="Registro de gastos operativos"
      >
        <ExpenseCreateButton />
      </PageHeader>

      {expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Sin gastos registrados"
          description="Los gastos operativos apareceran aqui cuando los registres."
        />
      ) : (
        <div className="rounded-[9px] border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-[11px] uppercase tracking-wider">Fecha</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Tipo</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider">Monto</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Categoria</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Concepto</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Asignado a</TableHead>
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
                      <span className={expense.type === "compra" ? "tx-pill withdraw" : "tx-pill expense"}>
                        {expense.type === "compra" ? "Compra" : "Gasto"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right num font-semibold margin-bad">
                      -{formatCurrency(Number(expense.amount))}
                    </TableCell>
                    <TableCell>
                      <span className={catConfig.cls}>
                        {catConfig.label}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium text-[12.5px]">
                      {expense.concept}
                    </TableCell>
                    <TableCell className="text-[12.5px] text-muted-foreground">
                      {expense.product?.name || expense.pack?.name || expense.productGroup?.name || expense.supplier?.name || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <ExpenseDeleteButton
                        expenseId={expense.id}
                        expenseConcept={expense.concept}
                      />
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
