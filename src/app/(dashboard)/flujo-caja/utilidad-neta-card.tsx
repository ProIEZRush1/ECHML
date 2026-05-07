"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface UtilidadNetaCardProps {
  serverNet: number;
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

  const totalNet = adsCost !== null ? serverNet - adsCost : serverNet;
  const loading = adsCost === null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Utilidad Neta
        </CardTitle>
        <div className="rounded-md p-2 bg-blue-100 dark:bg-blue-900/30">
          {loading ? (
            <Loader2 className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />
          ) : (
            <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className={`text-xl font-bold truncate ${totalNet >= 0 ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400"}`}>
          {formatCurrency(totalNet)}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Todo: comisiones, envios, impuestos, costo, gastos, ads, flex
        </p>
        {adsCost !== null && adsCost > 0 && (
          <p className="text-xs text-pink-600 dark:text-pink-400 mt-0.5">
            Incluye {formatCurrency(adsCost)} en publicidad
          </p>
        )}
      </CardContent>
    </Card>
  );
}
