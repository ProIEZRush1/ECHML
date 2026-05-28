"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

interface UtilidadNetaCardProps {
  serverNet: number;
}

function fmt(n: number) {
  return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function UtilidadNetaCard({ serverNet }: UtilidadNetaCardProps) {
  const searchParams = useSearchParams();
  const [adsCost, setAdsCost] = useState<number | null>(null);

  const dateFrom = searchParams.get("dateFrom") || "";
  const dateTo = searchParams.get("dateTo") || "";
  const productIds = searchParams.get("productIds") || searchParams.get("productId") || "";
  const packIds = searchParams.get("packIds") || searchParams.get("packId") || "";

  useEffect(() => {
    setAdsCost(null);
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (productIds) params.set("productIds", productIds);
    if (packIds) params.set("packIds", packIds);

    fetch(`/api/ads-costs?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAdsCost(d?.totalAdsCost ?? 0))
      .catch(() => setAdsCost(0));
  }, [dateFrom, dateTo, productIds, packIds]);

  const loading = adsCost === null;
  const totalNet = loading ? null : serverNet - adsCost;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Utilidad Neta</p>
        <span className="sw" style={{ background: "oklch(0.55 0.14 250)" }} />
      </div>
      {loading ? (
        <div className="flex items-center gap-2 h-7">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Calculando...</span>
        </div>
      ) : (
        <p className={`text-xl font-bold num truncate ${totalNet! >= 0 ? "margin-good" : "margin-bad"}`}>
          {fmt(totalNet!)}
        </p>
      )}
      <p className="text-[11px] text-muted-foreground mt-1">
        Todo: comisiones, envios, impuestos, costo, gastos, ads, flex
      </p>
      {adsCost !== null && adsCost > 0 && (
        <p className="text-[11px] text-pink-600 dark:text-pink-400 mt-0.5">
          Incluye {fmt(adsCost)} en publicidad
        </p>
      )}
    </div>
  );
}
