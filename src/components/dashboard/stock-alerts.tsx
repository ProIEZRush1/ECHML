import { ColorBadge } from "@/components/shared/color-badge";
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
      <div className="rounded-[9px] border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
          <h3 className="text-[12.5px] font-semibold">Alertas de stock</h3>
        </div>
        <div className="p-4 text-sm text-muted-foreground">
          Todos los productos tienen stock suficiente.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[9px] border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
        <h3 className="text-[12.5px] font-semibold">Alertas de stock</h3>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[oklch(0.72_0.14_78/0.16)] text-[oklch(0.48_0.13_70)]">
          <span className="w-[5px] h-[5px] rounded-full bg-current" />
          {alerts.length} bajos
        </span>
      </div>
      <div>
        {alerts.slice(0, 7).map((alert, index) => {
          const max = 50;
          const pct = Math.min(100, (alert.stock / max) * 100);
          const barClass = alert.stock === 0 ? "bg-destructive" : alert.stock <= 5 ? "bg-destructive" : "bg-[oklch(0.72_0.14_78)]";
          const qColor = alert.stock === 0 ? "text-destructive" : alert.stock <= 5 ? "text-destructive" : "text-[oklch(0.48_0.13_70)]";

          return (
            <div
              key={`${alert.supplierCode}-${alert.color}-${index}`}
              className="grid grid-cols-[1fr_auto_auto] gap-3 items-center px-4 py-2.5 border-b border-border last:border-0"
            >
              <div>
                <div className="text-[12.5px] font-medium">{alert.productName}</div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <ColorBadge color={alert.color} showLabel={false} />
                  <span className="mono text-[11px]">{alert.supplierCode}</span>
                </div>
              </div>
              <div className="w-[120px] h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full ${barClass}`} style={{ width: `${pct}%` }} />
              </div>
              <div className={`mono num text-[13px] font-semibold min-w-[32px] text-right ${qColor}`}>
                {alert.stock}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
