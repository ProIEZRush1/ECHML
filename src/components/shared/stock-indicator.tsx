import { getStockStatus, getStockColor } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface StockIndicatorProps {
  stock: number;
  showBadge?: boolean;
}

export function StockIndicator({ stock, showBadge = true }: StockIndicatorProps) {
  const status = getStockStatus(stock);
  const colorClass = getStockColor(stock);

  const statusLabels: Record<typeof status, string> = {
    healthy: "En stock",
    low: "Stock bajo",
    out: "Sin stock",
  };

  if (!showBadge) {
    return (
      <span className={`text-sm font-medium ${colorClass}`}>
        {stock} unidades
      </span>
    );
  }

  const badgeVariant = status === "out" ? "destructive" : "secondary";

  return (
    <Badge variant={badgeVariant} className={colorClass}>
      {stock} - {statusLabels[status]}
    </Badge>
  );
}
