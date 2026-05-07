import { formatCurrency } from "@/lib/utils";

interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({
  data,
  total,
  totalLabel = "Neto",
}: {
  data: DonutSegment[];
  total: number;
  totalLabel?: string;
}) {
  const sum = data.reduce((s, d) => s + d.value, 0);
  const r = 56;
  const c = 2 * Math.PI * r;
  let off = 0;

  return (
    <div className="donut">
      <svg width="130" height="130" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={r} fill="none" stroke="var(--muted)" strokeWidth="14" />
        {data.map((d, i) => {
          const len = (d.value / sum) * c;
          const dash = `${len} ${c - len}`;
          const el = (
            <circle
              key={i}
              cx="65"
              cy="65"
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth="14"
              strokeDasharray={dash}
              strokeDashoffset={-off}
            />
          );
          off += len;
          return el;
        })}
      </svg>
      <div className="center">
        <span>
          <b className="mono text-lg font-semibold block">{formatCurrency(total)}</b>
          <small className="text-[10.5px] text-muted-foreground uppercase tracking-wider">{totalLabel}</small>
        </span>
      </div>
    </div>
  );
}
