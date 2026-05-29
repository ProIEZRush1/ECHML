"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, Loader2, Pencil } from "lucide-react";

interface RealMpBalance {
  disponible: number;
  futuro: number;
  total: number;
  source: "api" | "manual" | "none";
  asOf: string | null;
}
interface ReconFlag { level: "warn" | "info"; label: string; detail: string; amount?: number }
export interface ReconProps {
  ventasNetas: number;
  flexNeto: number;
  retiros: number;
  gastosDesdeMP: number;
  saldoLibros: number;
  real: RealMpBalance;
  diferencia: number;
  cuadrado: boolean;
  ventasBrutas: number;
  comisiones: number;
  envios: number;
  devueltasExcluidas: number;
  devolucionesParciales: number;
  hasMpAccount: boolean;
  flags: ReconFlag[];
}

const fmt = (n: number) => formatCurrency(n);

export function ReconciliationCard({ recon }: { recon: ReconProps }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [disponible, setDisponible] = useState(String(recon.real.source === "manual" ? recon.real.disponible : ""));
  const [futuro, setFuturo] = useState(String(recon.real.source === "manual" ? recon.real.futuro : ""));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await fetch("/api/mp/real-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disponible: Number(disponible) || 0, futuro: Number(futuro) || 0 }),
      });
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const hasReal = recon.real.source !== "none";

  return (
    <div className="rounded-xl border border-border bg-card glass overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <p className="text-[13px] font-semibold">Conciliación de Caja · Mercado Pago</p>
          <p className="text-[11px] text-muted-foreground">
            Lo que <strong>debería</strong> haber en MP (según tus ventas, flex, retiros y gastos) vs. el saldo <strong>real</strong> (disponible + a liberar). Si no cuadra, hay un problema.
          </p>
        </div>
        <button
          onClick={() => setEditing((e) => !e)}
          className="text-[11px] inline-flex items-center gap-1 text-accent hover:underline shrink-0"
        >
          <Pencil className="h-3 w-3" /> Saldo real
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
        {/* Books waterfall */}
        <div className="rounded-lg border border-border bg-muted/20 p-3 text-[12px] space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Según tus libros</p>
          <Row label="Ventas netas (− comis. − envío)" value={recon.ventasNetas} sign="+" />
          {recon.devolucionesParciales > 0 && <Row label="Reembolsos parciales" value={-recon.devolucionesParciales} sign="" raw />}
          <Row label="Flex neto" value={recon.flexNeto} sign={recon.flexNeto >= 0 ? "+" : ""} raw />
          <Row label="Retiros" value={-recon.retiros} sign="" raw />
          {recon.hasMpAccount && <Row label="Gastos pagados desde MP" value={-recon.gastosDesdeMP} sign="" raw />}
          <div className="border-t border-border pt-1 mt-1 flex justify-between font-semibold">
            <span>Saldo esperado</span>
            <span className="num">{fmt(recon.saldoLibros)}</span>
          </div>
        </div>

        {/* Real balance */}
        <div className="rounded-lg border border-border bg-muted/20 p-3 text-[12px] space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
            Real en Mercado Pago {recon.real.source === "api" ? "(API)" : recon.real.source === "manual" ? "(manual)" : ""}
          </p>
          {editing ? (
            <div className="space-y-2">
              <label className="block text-[11px] text-muted-foreground">Disponible
                <input type="number" value={disponible} onChange={(e) => setDisponible(e.target.value)}
                  className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1 num" placeholder="0.00" />
              </label>
              <label className="block text-[11px] text-muted-foreground">A liberar (futuro)
                <input type="number" value={futuro} onChange={(e) => setFuturo(e.target.value)}
                  className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1 num" placeholder="0.00" />
              </label>
              <button onClick={save} disabled={saving}
                className="w-full rounded bg-accent/15 hover:bg-accent/25 text-accent text-[12px] py-1.5 inline-flex items-center justify-center gap-1">
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Guardar
              </button>
            </div>
          ) : hasReal ? (
            <>
              <div className="flex justify-between"><span>Disponible</span><span className="num">{fmt(recon.real.disponible)}</span></div>
              <div className="flex justify-between"><span>A liberar (futuro)</span><span className="num">{fmt(recon.real.futuro)}</span></div>
              <div className="border-t border-border pt-1 mt-1 flex justify-between font-semibold">
                <span>Saldo real</span><span className="num">{fmt(recon.real.total)}</span>
              </div>
              {recon.real.asOf && <p className="text-[10px] text-muted-foreground">al {new Date(recon.real.asOf).toLocaleString("es-MX")}</p>}
            </>
          ) : (
            <p className="text-[12px] text-muted-foreground">Sin saldo real. Click <strong>“Saldo real”</strong> arriba para capturarlo.</p>
          )}
        </div>

        {/* Difference verdict */}
        <div className={`rounded-lg border p-3 flex flex-col items-center justify-center text-center ${!hasReal ? "border-border bg-muted/20" : recon.cuadrado ? "border-green-600/40 bg-green-600/10" : "border-rose-500/40 bg-rose-500/10"}`}>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Diferencia</p>
          {!hasReal ? (
            <p className="text-2xl font-bold text-muted-foreground mt-1">—</p>
          ) : (
            <>
              <div className="flex items-center gap-1.5 mt-1">
                {recon.cuadrado ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <AlertTriangle className="h-5 w-5 text-rose-500" />}
                <p className={`text-2xl font-bold num ${recon.cuadrado ? "text-green-600" : "text-rose-500"}`}>{fmt(recon.diferencia)}</p>
              </div>
              <p className={`text-[11px] mt-1 font-medium ${recon.cuadrado ? "text-green-600" : "text-rose-500"}`}>
                {recon.cuadrado ? "Cuadrado ✓" : "¡Descuadre! Revisar"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">libros − real</p>
            </>
          )}
        </div>
      </div>

      {recon.flags.length > 0 && (
        <div className="px-4 pb-4 space-y-1.5">
          {recon.flags.map((f, i) => (
            <div key={i} className={`flex items-start gap-2 text-[11px] rounded-md p-2 ${f.level === "warn" ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : "bg-muted/40 text-muted-foreground"}`}>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span><strong>{f.label}:</strong> {f.detail}{typeof f.amount === "number" ? ` (${fmt(f.amount)})` : ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, sign, raw }: { label: string; value: number; sign: string; raw?: boolean }) {
  const display = raw ? value : Math.abs(value);
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="num">{sign}{fmt(display)}</span>
    </div>
  );
}
