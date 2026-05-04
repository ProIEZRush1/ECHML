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
import { Badge } from "@/components/ui/badge";
import { Receipt } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ExpenseCreateButton } from "@/components/expenses/expense-create-button";
import { ExpenseDeleteButton } from "@/components/expenses/expense-delete-button";

const CATEGORY_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline"; className: string }> = {
  proveedor: { label: "Proveedor", variant: "default", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-100" },
  envio: { label: "Envio", variant: "default", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 hover:bg-purple-100" },
  suscripcion: { label: "Suscripcion", variant: "default", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 hover:bg-amber-100" },
  publicidad: { label: "Publicidad", variant: "default", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-100" },
  otro: { label: "Otro", variant: "secondary", className: "" },
};

export default async function GastosPage() {
  const expenses = await prisma.expense.findMany({
    include: {
      supplier: { select: { name: true } },
    },
    orderBy: { date: "desc" },
  });

  return (
    <div className="space-y-6">
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
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => {
                const catConfig = CATEGORY_CONFIG[expense.category] || CATEGORY_CONFIG.otro;

                return (
                  <TableRow key={expense.id} className="hover:bg-muted/50">
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(expense.date)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-red-600 dark:text-red-400">
                      -{formatCurrency(Number(expense.amount))}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={catConfig.variant}
                        className={catConfig.className}
                      >
                        {catConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {expense.concept}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {expense.supplier?.name || "-"}
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
