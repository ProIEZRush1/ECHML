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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-border bg-card glass p-5 flex flex-col gap-2 transition-all duration-200 hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5"
        >
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">
            {card.label}
          </div>
          <div className={`mono num text-3xl font-bold tracking-tight ${card.valueColor || ""}`}>
            {card.value}
          </div>
          <div className="text-[12px] text-muted-foreground">
            {card.desc}
          </div>
        </div>
      ))}
    </div>
  );
}
