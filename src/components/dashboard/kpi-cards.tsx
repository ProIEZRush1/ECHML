import { Package, Boxes, DollarSign, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { DashboardStats } from "@/types";

interface KpiCardsProps {
  stats: DashboardStats;
}

export function KpiCards({ stats }: KpiCardsProps) {
  const cards = [
    {
      title: "Productos",
      value: stats.totalProducts,
      description: `${stats.totalVariants} variantes registradas`,
      icon: Package,
      iconBg: "bg-blue-100 dark:bg-blue-900/30",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      title: "Packs",
      value: stats.totalPacks,
      description: `${stats.totalListings} publicaciones activas`,
      icon: Boxes,
      iconBg: "bg-green-100 dark:bg-green-900/30",
      iconColor: "text-green-600 dark:text-green-400",
    },
    {
      title: "Valor de Inventario",
      value: formatCurrency(stats.totalStockValue),
      description: "Costo total en stock",
      icon: DollarSign,
      iconBg: "bg-amber-100 dark:bg-amber-900/30",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
    {
      title: "Alertas de Stock",
      value: stats.lowStockAlerts,
      description: stats.outOfStockAlerts > 0
        ? `${stats.outOfStockAlerts} sin stock`
        : "Todos con stock",
      icon: AlertTriangle,
      iconBg: stats.lowStockAlerts > 0
        ? "bg-red-100 dark:bg-red-900/30"
        : "bg-green-100 dark:bg-green-900/30",
      iconColor: stats.lowStockAlerts > 0
        ? "text-red-600 dark:text-red-400"
        : "text-green-600 dark:text-green-400",
      valueColor: stats.outOfStockAlerts > 0
        ? "text-red-600 dark:text-red-400"
        : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className={`rounded-md p-2 ${card.iconBg}`}>
              <card.icon className={`h-4 w-4 ${card.iconColor}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${card.valueColor || ""}`}>
              {card.value}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {card.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
