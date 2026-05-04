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
import { ArrowDownToLine } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { WithdrawalCreateButton } from "@/components/withdrawals/withdrawal-create-button";
import { WithdrawalDeleteButton } from "@/components/withdrawals/withdrawal-delete-button";

const METHOD_LABELS: Record<string, string> = {
  bank: "Banco",
  cash: "Efectivo",
  provider: "Proveedor",
};

const METHOD_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  bank: "default",
  cash: "secondary",
  provider: "outline",
};

export default async function RetirosPage() {
  const withdrawals = await prisma.withdrawal.findMany({
    include: {
      allocations: {
        include: {
          pack: { select: { sku: true, name: true } },
        },
      },
    },
    orderBy: { date: "desc" },
  });

  return (
    <div className="space-y-6">
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
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead>Metodo</TableHead>
                <TableHead>Asignacion</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {withdrawals.map((withdrawal) => {
                const allocationSummary = withdrawal.allocations
                  .filter((a) => a.pack)
                  .map(
                    (a) =>
                      `${a.pack!.sku}: ${formatCurrency(Number(a.amount))}`
                  )
                  .join(" + ");

                return (
                  <TableRow key={withdrawal.id} className="hover:bg-muted/50">
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(withdrawal.date)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-red-600 dark:text-red-400">
                      -{formatCurrency(Number(withdrawal.amount))}
                    </TableCell>
                    <TableCell className="font-medium">
                      {withdrawal.concept}
                    </TableCell>
                    <TableCell>
                      <Badge variant={METHOD_VARIANTS[withdrawal.method] || "secondary"}>
                        {METHOD_LABELS[withdrawal.method] || withdrawal.method}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {allocationSummary || "Sin asignar"}
                    </TableCell>
                    <TableCell className="text-right">
                      <WithdrawalDeleteButton
                        withdrawalId={withdrawal.id}
                        withdrawalConcept={withdrawal.concept}
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
