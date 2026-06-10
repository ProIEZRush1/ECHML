"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

interface GroupARetirar {
  groupId: string | null;
  groupName: string;
  groupColor: string;
  aRetirarPreAds: number;
}

interface Props {
  realMpTotal: number;
  realSource: "api" | "manual" | "none";
  groups: GroupARetirar[];
  productToGroupMap: Record<string, string>;
}

const fmt = (n: number) => formatCurrency(n);

// "¿Cuánto falta en Mercado Pago?" — compara el saldo REAL de MP contra el "Dinero a Retirar"
// (P&L) que cada grupo debería poder retirar. Si la suma de lo a-retirar es mayor que el saldo
// real, ese faltante = dinero que ya se tomó sin registrar (o un descuadre). MP es una sola
// bolsa, así que el saldo real se reparte proporcional a lo que cada grupo debe retirar.
export function MissingMoneyCard({ realMpTotal, realSource, groups, productToGroupMap }: Props) {
  const [adsByGroup, setAdsByGroup] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    // All-time ads (la conciliación de MP es a la fecha, no filtrada).
    fetch(`/api/ads-costs`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) { setAdsByGroup({}); return; }
        const result: Record<string, number> = {};
        for (const p of data.byProduct || []) {
          const gId = productToGroupMap[p.productId] || "__none__";
          result[gId] = (result[gId] || 0) + (p.cost || 0);
        }
        setAdsByGroup(result);
      })
      .catch(() => setAdsByGroup({}));
  }, [productToGroupMap]);

  if (adsByGroup === null) {
    return (
      <div className="rounded-xl border border-border bg-card glass p-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Calculando dinero a retirar…
      </div>
    );
  }

  const keyOf = (g: GroupARetirar) => g.groupId ?? "__none__";
  const rows = groups
    .map((g) => {
      const ads = adsByGroup[keyOf(g)] || 0;
      return { ...g, ads, aRetirar: g.aRetirarPreAds - ads };
    })
    .sort((a, b) => b.aRetirar - a.aRetirar);

  const totalARetirar = rows.reduce((s, r) => s + r.aRetirar, 0);
  const falta = totalARetirar - realMpTotal; // >0 → falta dinero en MP ; <0 → sobra
  const hasReal = realSource !== "none";

  // Reparto del saldo real proporcional a lo que cada grupo debe retirar (solo positivos).
  const positivos = rows.reduce((s, r) => s + Math.max(0, r.aRetirar), 0);
  const withShare = rows.map((r) => {
    const enMp = hasReal && positivos > 0 ? (realMpTotal * Math.max(0, r.aRetirar)) / positivos : 0;
    return { ...r, enMp, faltaG: r.aRetirar - enMp };
  });

  return (
    <div className="rounded-xl border border-border bg-card glass overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-[13px] font-semibold">¿Cuánto falta en Mercado Pago?</p>
        <p className="text-[11px] text-muted-foreground">
          Suma de lo que <strong>cada grupo debería poder retirar</strong> (Dinero a Retirar: ventas netas + flex − retiros − gastos − ads, sin costo de producto) vs. el saldo <strong>real</strong> de MP. Lo que sobra de los a-retirar por encima del saldo real = <strong>dinero faltante</strong> (normalmente retiros no registrados).
        </p>
      </div>

      {/* Headline: real vs a retirar vs falta */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4">
        <Cell label="Saldo real en MP" value={hasReal ? fmt(realMpTotal) : "—"} sub={realSource === "api" ? "API" : realSource === "manual" ? "manual" : "captúralo arriba"} />
        <Cell label="Total a retirar (todos los grupos)" value={fmt(totalARetirar)} sub={`${rows.length} grupos`} />
        <div className={`rounded-lg border p-3 flex flex-col items-center justify-center text-center ${!hasReal ? "border-border bg-muted/20" : Math.abs(falta) < 100 ? "border-green-600/40 bg-green-600/10" : falta > 0 ? "border-rose-500/40 bg-rose-500/10" : "border-amber-500/40 bg-amber-500/10"}`}>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            {!hasReal ? "Falta / Sobra" : falta > 0 ? "Falta en MP" : "Sobra en MP"}
          </p>
          {!hasReal ? (
            <p className="text-2xl font-bold text-muted-foreground mt-1">—</p>
          ) : (
            <div className="flex items-center gap-1.5 mt-1">
              {Math.abs(falta) < 100 ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <AlertTriangle className={`h-5 w-5 ${falta > 0 ? "text-rose-500" : "text-amber-500"}`} />}
              <p className={`text-2xl font-bold num ${Math.abs(falta) < 100 ? "text-green-600" : falta > 0 ? "text-rose-500" : "text-amber-500"}`}>{fmt(Math.abs(falta))}</p>
            </div>
          )}
          <p className="text-[10px] text-muted-foreground mt-0.5">a retirar − real</p>
        </div>
      </div>

      {!hasReal && (
        <div className="px-4 pb-3">
          <div className="flex items-start gap-2 text-[11px] rounded-md p-2 bg-amber-500/10 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>Captura el <strong>saldo real de Mercado Pago</strong> en la tarjeta “Conciliación de Caja” de arriba (botón “Saldo real”) para ver el faltante.</span>
          </div>
        </div>
      )}

      {/* Per-group table */}
      <div className="px-4 pb-4">
        <div className="rounded-lg border border-border bg-muted/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left font-medium px-3 py-1.5">Grupo</th>
                  <th className="text-right font-medium px-2 py-1.5">A retirar (P&L)</th>
                  <th className="text-right font-medium px-2 py-1.5">Ads</th>
                  {hasReal && <th className="text-right font-medium px-2 py-1.5">En MP (estim.)</th>}
                  {hasReal && <th className="text-right font-medium px-3 py-1.5">Falta / Sobra</th>}
                </tr>
              </thead>
              <tbody>
                {withShare.map((r) => (
                  <tr key={keyOf(r)} className="border-b border-border/50 last:border-0">
                    <td className="px-3 py-1.5">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: r.groupColor }} />
                        <span className="font-medium">{r.groupName}</span>
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right num font-semibold">{fmt(r.aRetirar)}</td>
                    <td className="px-2 py-1.5 text-right num">{r.ads !== 0 ? `-${fmt(r.ads)}` : "—"}</td>
                    {hasReal && <td className="px-2 py-1.5 text-right num text-muted-foreground">{fmt(r.enMp)}</td>}
                    {hasReal && (
                      <td className={`px-3 py-1.5 text-right num font-semibold ${Math.abs(r.faltaG) < 50 ? "text-muted-foreground" : r.faltaG > 0 ? "text-rose-500" : "text-amber-500"}`}>
                        {r.faltaG > 0 ? `falta ${fmt(r.faltaG)}` : r.faltaG < 0 ? `sobra ${fmt(-r.faltaG)}` : "—"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-semibold">
                  <td className="px-3 py-1.5">Total</td>
                  <td className="px-2 py-1.5 text-right num">{fmt(totalARetirar)}</td>
                  <td className="px-2 py-1.5 text-right num" />
                  {hasReal && <td className="px-2 py-1.5 text-right num">{fmt(realMpTotal)}</td>}
                  {hasReal && (
                    <td className={`px-3 py-1.5 text-right num ${falta > 0 ? "text-rose-500" : "text-amber-500"}`}>
                      {falta > 0 ? `falta ${fmt(falta)}` : falta < 0 ? `sobra ${fmt(-falta)}` : "$0"}
                    </td>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
          {hasReal && (
            <div className="px-3 py-2 border-t border-border">
              <p className="text-[10px] text-muted-foreground">
                MP es una sola bolsa: el saldo real se reparte proporcional a lo que cada grupo debe retirar. Un <strong>faltante</strong> grande señala el grupo donde probablemente hay retiros no registrados.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Cell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 flex flex-col items-center justify-center text-center">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <p className="text-2xl font-bold num mt-1">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}
