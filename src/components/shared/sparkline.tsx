export function Sparkline({ data, className = "" }: { data: number[]; className?: string }) {
  const w = 92, h = 28;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg className={`spark ${className}`} width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline fill="none" stroke="var(--accent)" strokeWidth="1.4" points={pts} />
    </svg>
  );
}
