"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

function fmt(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

interface Props {
  serverNet: number;
  serverAvailable: number;
  totalWithdrawn: number;
  showWithdraw: boolean;
}

export function FinancialCardsWrapper({ serverNet, serverAvailable, totalWithdrawn, showWithdraw }: Props) {
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

    let retries = 0;
    const fetchAds = () => {
      fetch(`/api/ads-costs?${params.toString()}`)
        .then((r) => {
          if (!r.ok) throw new Error("Failed");
          return r.json();
        })
        .then((data) => {
          let cost = data?.totalAdsCost ?? 0;
          if (productIds) {
            const pIds = productIds.split(",").filter(Boolean);
            const filtered = (data.byProduct || []).filter((p: { productId: string }) => pIds.includes(p.productId));
            cost = filtered.reduce((s: number, p: { cost: number }) => s + p.cost, 0);
          }
          setAdsCost(Math.round(cost * 100) / 100);
        })
        .catch(() => {
          if (retries < 2) {
            retries++;
            setTimeout(fetchAds, 1000 * retries);
          } else {
            setAdsCost(0);
          }
        });
    };
    fetchAds();
  }, [dateFrom, dateTo, productIds, packIds]);

  const loading = adsCost === null;
  const totalNet = loading ? null : serverNet - adsCost;
  const available = loading ? null : serverAvailable - adsCost;

  return (
    <>
      {/* Utilidad Neta */}
      <div className="rounded-[9px] border border-border bg-card p-4">
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

      {/* Dinero a Retirar */}
      {showWithdraw && (
        <div className="rounded-[9px] border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Dinero a Retirar</p>
            <span className="sw" style={{ background: "oklch(0.55 0.16 160)" }} />
          </div>
          {loading ? (
            <div className="flex items-center gap-2 h-7">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Calculando...</span>
            </div>
          ) : (
            <p className={`text-xl font-bold num truncate ${available! >= 0 ? "margin-good" : "margin-bad"}`}>
              {fmt(available!)}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">
            Sin costo producto · Ads: -{fmt(adsCost ?? 0)} · Retirado: {fmt(totalWithdrawn)}
          </p>
        </div>
      )}
    </>
  );
}
