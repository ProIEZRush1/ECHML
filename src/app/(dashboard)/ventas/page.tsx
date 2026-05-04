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
import { ShoppingCart } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export default async function VentasPage() {
  const orders = await prisma.mLOrder.findMany({
    take: 50,
    orderBy: { dateCreated: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ventas"
        description="Historial de ordenes de MercadoLibre"
      />

      {orders.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Sin ventas registradas"
          description="Las ventas apareceran aqui cuando se procesen ordenes desde MercadoLibre."
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Orden ML</TableHead>
                <TableHead>Articulo ML</TableHead>
                <TableHead className="text-center">Cantidad</TableHead>
                <TableHead className="text-right">Precio Unit.</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatDateTime(order.dateCreated)}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {order.mlOrderId.toString()}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {order.mlItemId}
                  </TableCell>
                  <TableCell className="text-center">{order.quantity}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(order.unitPrice.toString())}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(order.totalAmount.toString())}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{order.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
