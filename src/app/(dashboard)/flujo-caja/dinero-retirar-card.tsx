"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function fmt(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

export function DineroRetirarCard({ serverAmount, totalWithdrawn }: { serverAmount: number; totalWithdrawn: number }) {
  const searchParams = useSearchParams();
  const [adsCost, setAdsCost] = useState(0);
  const [loading, setLoading] = useState(true);

  const dateFrom = searchParams.get("dateFrom") || "";
  const dateTo = searchParams.get("dateTo") || "";
  const productIds = searchParams.get("productIds") || searchParams.get("productId") || "";

  useEffect(() => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    fetch(`/api/ads-costs?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (productIds) {
          const pIds = productIds.split(",").filter(Boolean);
          const filtered = (data.byProduct || []).filter((p: { productId: string }) => pIds.includes(p.productId));
          setAdsCost(filtered.reduce((s: number, p: { cost: number }) => s + p.cost, 0));
        } else {
          setAdsCost(data.totalAdsCost || 0);
        }
      })
      .catch(() => setAdsCost(0))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo, productIds]);

  const available = serverAmount - adsCost;

  return (
    <div className="rounded-[9px] border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Dinero a Retirar</p>
        <span className="sw" style={{ background: "oklch(0.55 0.16 160)" }} />
      </div>
      <p className={`text-xl font-bold num truncate ${available >= 0 ? "margin-good" : "margin-bad"}`}>
        {loading ? "..." : fmt(available)}
      </p>
      <p className="text-[11px] text-muted-foreground mt-1">
        Sin costo producto · Ads: -{fmt(adsCost)} · Retirado: {fmt(totalWithdrawn)}
      </p>
    </div>
  );
}
