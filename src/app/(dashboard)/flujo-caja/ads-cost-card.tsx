"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Megaphone, Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

interface AdsCostData {
  totalAdsCost: number;
  totalClicks: number;
  totalSalesFromAds: number;
  overallAcos: number;
  byProduct: Array<{
    productId: string;
    name: string;
    brand: string | null;
    cost: number;
    clicks: number;
    salesAmount: number;
    acos: number;
    items: Array<{ id: string; title: string; cost: number; clicks: number; salesAmount: number; units: number }>;
  }>;
}

function filterByProductsOrPacks(data: AdsCostData, productIds: string, packIds: string): AdsCostData {
  const pIds = productIds ? productIds.split(",").filter(Boolean) : [];
  const pkIds = packIds ? packIds.split(",").filter(Boolean) : [];

  if (pIds.length === 0 && pkIds.length === 0) return data;

  const filtered = data.byProduct.filter((p) => {
    if (pIds.length > 0 && pIds.includes(p.productId)) return true;
    return false;
  });

  const totalCost = filtered.reduce((s, p) => s + p.cost, 0);
  const totalClicks = filtered.reduce((s, p) => s + p.clicks, 0);
  const totalSales = filtered.reduce((s, p) => s + p.salesAmount, 0);

  return {
    totalAdsCost: Math.round(totalCost * 100) / 100,
    totalClicks,
    totalSalesFromAds: Math.round(totalSales * 100) / 100,
    overallAcos: totalSales > 0 ? Math.round((totalCost / totalSales) * 10000) / 100 : 0,
    byProduct: filtered,
  };
}

export function AdsCostCard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [data, setData] = useState<AdsCostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const dateFrom = searchParams.get("dateFrom") || "";
  const dateTo = searchParams.get("dateTo") || "";
  const productIds = searchParams.get("productIds") || searchParams.get("productId") || "";
  const packIds = searchParams.get("packIds") || searchParams.get("packId") || "";

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (productIds) params.set("productIds", productIds);
    if (packIds) params.set("packIds", packIds);

    fetch(`/api/ads-costs?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo, productIds, packIds]);

  const fmt = (n: number) =>
    `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Publicidad</CardTitle>
          <div className="rounded-md p-2 bg-pink-100 dark:bg-pink-900/30">
            <Loader2 className="h-4 w-4 text-pink-600 animate-spin" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold text-muted-foreground">Cargando...</div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const acosColor = (acos: number) => {
    if (acos === 0) return "text-muted-foreground";
    if (acos <= 15) return "text-emerald-500";
    if (acos <= 25) return "text-amber-500";
    return "text-rose-500";
  };

  return (
    <div className="space-y-5">
      {/* Hero Ads KPI */}
      <div className="rounded-xl border border-border bg-card glass p-6 relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-gradient-to-b from-pink-400 to-purple-600" />
        <div className="flex items-center justify-between mb-4 pl-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Publicidad (Ads)</p>
          </div>
          <button
            onClick={async () => {
              setSyncing(true);
              try {
                await fetch(`/api/ads-costs`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }),
                });
                router.refresh();
                window.location.reload();
              } finally { setSyncing(false); }
            }}
            disabled={syncing}
            className="rounded-lg p-2 bg-pink-500/10 hover:bg-pink-500/20 transition-colors"
            title="Sincronizar publicidad desde ML"
          >
            {syncing ? <Loader2 className="h-4 w-4 text-pink-500 animate-spin" /> : <RefreshCw className="h-4 w-4 text-pink-500" />}
          </button>
        </div>
        <div className="pl-4">
          <p className="text-3xl font-bold text-pink-500 tracking-tight">-{fmt(data.totalAdsCost)}</p>
          <div className="flex items-center gap-4 mt-3 text-[13px]">
            <span className="text-muted-foreground">{data.totalClicks.toLocaleString()} clicks</span>
            <span className={`font-semibold ${acosColor(data.overallAcos)}`}>ACOS {data.overallAcos}%</span>
            <span className="text-emerald-500 font-medium">Ventas {fmt(data.totalSalesFromAds)}</span>
          </div>
        </div>
      </div>

      {/* Per-product breakdown — Card grid */}
      {data.byProduct.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold">Rendimiento por Producto</h3>
            <button onClick={() => setExpanded(!expanded)} className="text-xs text-accent hover:underline font-medium">
              {expanded ? "Colapsar" : `Ver ${data.byProduct.length} productos`}
            </button>
          </div>
          <div className="space-y-3">
            {data.byProduct.slice(0, expanded ? 50 : 3).map((p) => (
              <div key={p.productId} className="rounded-xl border border-border bg-card glass p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[13px] truncate">{p.name}</p>
                    <p className="text-[12px] text-muted-foreground mt-0.5">
                      {p.clicks.toLocaleString()} clicks · {p.items.length} listing{p.items.length > 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="font-bold text-pink-500 text-sm">{fmt(p.cost)}</p>
                    {p.salesAmount > 0 && <p className="text-[12px] text-emerald-500 font-medium">+{fmt(p.salesAmount)}</p>}
                  </div>
                </div>
                {/* ACOS bar */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${p.acos <= 15 ? "bg-emerald-500" : p.acos <= 25 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${Math.min(p.acos, 100)}%` }} />
                  </div>
                  <span className={`text-xs font-bold mono ${acosColor(p.acos)}`}>ACOS {p.acos}%</span>
                </div>
                {/* Item grid */}
                {p.items.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {p.items.sort((a, b) => b.clicks - a.clicks).slice(0, 9).map((item) => (
                      <div key={item.id} className="rounded-lg bg-muted/50 p-2.5 text-[11px]">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-muted-foreground truncate">{item.id.replace("MLM", "")}</span>
                          <span className={`font-bold ${acosColor(item.salesAmount > 0 ? Math.round((item.cost / item.salesAmount) * 100) : 0)}`}>
                            {item.salesAmount > 0 ? `${Math.round((item.cost / item.salesAmount) * 100)}%` : "-"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">{item.clicks} clicks</span>
                          <span className="font-medium text-pink-500">{fmt(item.cost)}</span>
                        </div>
                        {item.units > 0 && (
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-emerald-500">{item.units} ventas</span>
                            <span className="text-emerald-500">+{fmt(item.salesAmount)}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
