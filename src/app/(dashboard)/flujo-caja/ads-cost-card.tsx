"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Megaphone, Loader2 } from "lucide-react";

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
  const [data, setData] = useState<AdsCostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

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

  return (
    <div className="space-y-4">
      {/* KPI Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Publicidad (Ads)</CardTitle>
          <div className="rounded-md p-2 bg-pink-100 dark:bg-pink-900/30">
            <Megaphone className="h-4 w-4 text-pink-600 dark:text-pink-400" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold text-pink-600 dark:text-pink-400 truncate">
            -{fmt(data.totalAdsCost)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {data.totalClicks} clicks · ACOS {data.overallAcos}% · Ventas por ads {fmt(data.totalSalesFromAds)}
          </p>
        </CardContent>
      </Card>

      {/* Per-product breakdown */}
      {data.byProduct.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Gasto en Ads por Producto</CardTitle>
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {expanded ? "Ocultar" : `Ver ${data.byProduct.length} productos`}
              </button>
            </div>
          </CardHeader>
          {(expanded || data.byProduct.length <= 5) && (
            <CardContent className="pt-0">
              <div className="space-y-3">
                {data.byProduct.slice(0, expanded ? 50 : 5).map((p) => (
                  <div key={p.productId} className="border-b pb-2 last:border-0">
                    <div className="flex items-center justify-between text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-xs">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.clicks} clicks · ACOS {p.acos}% · {p.items.length} listing{p.items.length > 1 ? "s" : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="font-semibold text-pink-600 dark:text-pink-400 text-xs">{fmt(p.cost)}</p>
                        {p.salesAmount > 0 && (
                          <p className="text-xs text-green-600 dark:text-green-400">+{fmt(p.salesAmount)}</p>
                        )}
                      </div>
                    </div>
                    {p.items.length > 0 && (
                      <div className="mt-1.5 ml-2 space-y-1">
                        {p.items.sort((a, b) => b.cost - a.cost).map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <div className="min-w-0 flex-1">
                              <span className="font-mono">{item.id}</span>
                              <span className="ml-1.5">{item.clicks} clicks</span>
                              {item.units > 0 && <span className="ml-1 text-green-600">· {item.units} ventas</span>}
                            </div>
                            <div className="text-right shrink-0 ml-2">
                              <span className="text-pink-600 dark:text-pink-400">{fmt(item.cost)}</span>
                              {item.salesAmount > 0 && <span className="ml-1 text-green-600">+{fmt(item.salesAmount)}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
