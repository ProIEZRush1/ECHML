import { ColorBadge } from "@/components/shared/color-badge";
import { StockIndicator } from "@/components/shared/stock-indicator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import type { ColorKey } from "@/lib/utils";

interface StockAlert {
  productName: string;
  supplierCode: string;
  color: ColorKey;
  stock: number;
}

interface StockAlertsProps {
  alerts: StockAlert[];
}

export function StockAlerts({ alerts }: StockAlertsProps) {
  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4" />
            Alertas de Stock Bajo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No hay alertas de stock bajo. Todos los productos tienen stock suficiente.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Alertas de Stock Bajo
          <span className="ml-auto text-sm font-normal text-muted-foreground">
            {alerts.length} variantes
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Color</TableHead>
              <TableHead className="text-right">Stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alerts.map((alert, index) => (
              <TableRow key={`${alert.supplierCode}-${alert.color}-${index}`}>
                <TableCell className="font-medium">{alert.productName}</TableCell>
                <TableCell className="text-muted-foreground">
                  {alert.supplierCode}
                </TableCell>
                <TableCell>
                  <ColorBadge color={alert.color} />
                </TableCell>
                <TableCell className="text-right">
                  <StockIndicator stock={alert.stock} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
