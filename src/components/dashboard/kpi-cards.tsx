import { formatCurrency } from "@/lib/utils";
import type { DashboardStats } from "@/types";

interface KpiCardsProps {
  stats: DashboardStats;
}

export function KpiCards({ stats }: KpiCardsProps) {
  const cards = [
    {
      label: "PRODUCTOS",
      value: String(stats.totalProducts),
      desc: `${stats.totalVariants} variantes registradas`,
    },
    {
      label: "PACKS",
      value: String(stats.totalPacks),
      desc: `${stats.totalListings} publicaciones activas`,
    },
    {
      label: "VALOR INVENTARIO",
      value: formatCurrency(stats.totalStockValue),
      desc: "Costo total en stock",
    },
    {
      label: "ALERTAS STOCK",
      value: String(stats.lowStockAlerts),
      desc: stats.outOfStockAlerts > 0
        ? `${stats.outOfStockAlerts} sin stock`
        : "Todos con stock",
      valueColor: stats.outOfStockAlerts > 0 ? "text-destructive" : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-[9px] border border-border bg-card glass p-3.5 sm:p-4 flex flex-col gap-1.5 transition-all duration-200 hover:border-accent/30"
        >
          <div className="text-[10.5px] font-medium text-muted-foreground uppercase tracking-[0.06em]">
            {card.label}
          </div>
          <div className={`mono num text-2xl font-semibold tracking-tight ${card.valueColor || ""}`}>
            {card.value}
          </div>
          <div className="text-[11.5px] text-muted-foreground">
            {card.desc}
          </div>
        </div>
      ))}
    </div>
  );
}
