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
  const packIds = searchParams.get("packIds") || searchParams.get("packId") || "";

  useEffect(() => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (productIds) params.set("productIds", productIds);
    if (packIds) params.set("packIds", packIds);

    // Use the server-side filtered total so every card shows the same publicidad amount.
    fetch(`/api/ads-costs?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => setAdsCost(data.totalAdsCost || 0))
      .catch(() => setAdsCost(0))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo, productIds, packIds]);

  const available = serverAmount - adsCost;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
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
