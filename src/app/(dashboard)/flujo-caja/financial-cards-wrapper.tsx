"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

function fmt(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

interface Props {
  serverNet: number;
  serverAvailable: number;
  totalWithdrawn: number;
  totalGastos: number;
  totalFacturaCost: number;
  showWithdraw: boolean;
}

export function FinancialCardsWrapper({ serverNet, serverAvailable, totalWithdrawn, totalGastos, totalFacturaCost, showWithdraw }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [adsCost, setAdsCost] = useState<number | null>(null);
  const [depositing, setDepositing] = useState(false);

  const dateFrom = searchParams.get("dateFrom") || "";
  const dateTo = searchParams.get("dateTo") || "";
  const productIds = searchParams.get("productIds") || searchParams.get("productId") || "";
  const packIds = searchParams.get("packIds") || searchParams.get("packId") || "";

  useEffect(() => {
    setAdsCost(null);
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (packIds) params.set("packIds", packIds);
    if (productIds) params.set("productIds", productIds);

    let retries = 0;
    const fetchAds = () => {
      fetch(`/api/ads-costs?${params.toString()}`)
        .then((r) => {
          if (!r.ok) throw new Error("Failed");
          return r.json();
        })
        .then((data) => {
          setAdsCost(Math.round((data?.totalAdsCost ?? 0) * 100) / 100);
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
  const netAfterFactura = totalNet !== null ? totalNet * 0.97 : null;
  const available = loading ? null : serverAvailable - adsCost;

  async function handleDeposit() {
    if (available === null || available >= 0) return;
    const depositAmount = Math.round(Math.abs(available) * 100) / 100;

    setDepositing(true);
    try {
      const packIdList = packIds ? packIds.split(",").filter(Boolean) : [];

      const payload: Record<string, unknown> = {
        amount: -depositAmount,
        date: new Date().toISOString().split("T")[0],
        concept: "Deposito a cuenta ML",
        method: "bank",
      };

      if (packIdList.length === 1) {
        payload.allocations = [{ packId: packIdList[0], amount: -depositAmount }];
      }

      const res = await fetch("/api/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Error al crear deposito");
        return;
      }

      toast.success(`Deposito de ${fmt(depositAmount)} registrado`);
      router.refresh();
    } catch {
      toast.error("Error de conexion");
    } finally {
      setDepositing(false);
    }
  }

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
        {netAfterFactura !== null && totalNet !== null && totalNet > 0 && (
          <div className="mt-2 pt-2 border-t border-border">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Factura (3%)</span>
              <span className="num margin-bad">-{fmt(totalNet * 0.03)}</span>
            </div>
            <div className="flex items-center justify-between text-[12px] font-semibold mt-1">
              <span className="text-muted-foreground">Despues de factura</span>
              <span className={`num ${netAfterFactura >= 0 ? "margin-good" : "margin-bad"}`}>{fmt(netAfterFactura)}</span>
            </div>
          </div>
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
          <p className="text-[11px] text-muted-foreground mt-1 break-words">
            Sin costo producto
            {adsCost !== null && adsCost > 0 && <> · Ads -{fmt(adsCost)}</>}
            {totalGastos > 0 && <><br/>Gastos -{fmt(totalGastos)}</>}
            {totalWithdrawn > 0 && <> · Retirado {fmt(totalWithdrawn)}</>}
          </p>
          {available !== null && available < 0 && (
            <button
              onClick={handleDeposit}
              disabled={depositing}
              className="mt-2 w-full text-[12px] font-medium py-1.5 px-3 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {depositing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Depositar {fmt(Math.abs(available))} a cuenta ML
            </button>
          )}
        </div>
      )}
    </>
  );
}
