"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, Loader2, Pencil, ChevronRight, Package, RefreshCw } from "lucide-react";

interface RealMpBalance { disponible: number; futuro: number; total: number; source: "api" | "manual" | "none"; asOf: string | null }
interface ProductLine { productId: string | null; productName: string; vendido: number; inventarioValor: number; unidades: number }
interface GroupAccountability {
  groupId: string | null; groupName: string; groupColor: string;
  vendido: number; gastos: number; retiros: number; esperado: number;
  saldoMpAsignado: number; descuadre: number; inventarioValor: number; unidades: number;
  products: ProductLine[];
}
export interface AccountabilityData {
  startDate: string | null; real: RealMpBalance;
  vendido: number; gastos: number; retiros: number; esperado: number; descuadre: number;
  inventarioValor: number; unidades: number; hasMpAccount: boolean;
  byGroup: GroupAccountability[];
}

const fmt = (n: number) => formatCurrency(n);
const CUADRADO = 200; // |descuadre| under this = balanced

function verdict(descuadre: number): { label: string; cls: string; ok: boolean } {
  if (Math.abs(descuadre) < CUADRADO) return { label: "Cuadrado", cls: "text-green-600", ok: true };
  if (descuadre > 0) return { label: "Falta en MP", cls: "text-rose-500", ok: false };
  return { label: "Retirado de más", cls: "text-amber-500", ok: false };
}

export function AccountabilityView({ data, from }: { data: AccountabilityData; from: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [disponible, setDisponible] = useState(String(data.real.source === "manual" ? data.real.disponible : ""));
  const [futuro, setFuturo] = useState(String(data.real.source === "manual" ? data.real.futuro : ""));
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const hasReal = data.real.source !== "none";
  const v = verdict(data.descuadre);

  const saveBalance = async () => {
    setSaving(true);
    try {
      await fetch("/api/mp/real-balance", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disponible: Number(disponible) || 0, futuro: Number(futuro) || 0 }),
      });
      setEditing(false); router.refresh();
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      {/* Controls: start date + MP balance */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end justify-between">
        <label className="text-[12px]">
          <span className="block text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Desde</span>
          <input
            type="date" defaultValue={from}
            onChange={(e) => { const val = e.target.value; router.push(`/contabilidad${val ? `?from=${val}` : ""}`); }}
            className="rounded border border-border bg-background px-2 py-1 num"
          />
          <span className="ml-2 text-[11px] text-muted-foreground">hasta hoy (acumulado)</span>
        </label>
        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-border bg-card glass px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Saldo real MP {data.real.source === "api" ? "(live 🔄)" : data.real.source === "manual" ? "(manual)" : ""}
            </p>
            {editing ? (
              <div className="flex items-end gap-2 mt-1">
                <label className="text-[10px] text-muted-foreground">Disponible
                  <input type="number" value={disponible} onChange={(e) => setDisponible(e.target.value)} className="block w-24 rounded border border-border bg-background px-1.5 py-0.5 num" placeholder="0" />
                </label>
                <label className="text-[10px] text-muted-foreground">A liberar
                  <input type="number" value={futuro} onChange={(e) => setFuturo(e.target.value)} className="block w-24 rounded border border-border bg-background px-1.5 py-0.5 num" placeholder="0" />
                </label>
                <button onClick={saveBalance} disabled={saving} className="rounded bg-accent/15 hover:bg-accent/25 text-accent text-[12px] px-2 py-1 inline-flex items-center gap-1">
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Guardar
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xl font-bold num">{hasReal ? fmt(data.real.total) : "—"}</span>
                <button onClick={() => setEditing(true)} className="text-[11px] inline-flex items-center gap-1 text-accent hover:underline"><Pencil className="h-3 w-3" /> editar</button>
              </div>
            )}
          </div>
          {data.real.source !== "api" && (
            <a href="/api/ml/auth" className="text-[10px] text-muted-foreground hover:text-accent inline-flex items-center gap-1" title="Reautorizar Mercado Libre para intentar saldo live">
              <RefreshCw className="h-3 w-3" /> live
            </a>
          )}
        </div>
      </div>

      {/* The equation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card glass p-4">
          <p className="text-[13px] font-semibold mb-2">La cuenta · ¿cuadra el dinero?</p>
          <div className="text-[12.5px] space-y-1">
            <Row label="Vendido (neto que entró a MP)" value={data.vendido} sign="+" />
            {data.hasMpAccount && <Row label="Gastos pagados desde MP" value={-data.gastos} />}
            <Row label="Retirado" value={-data.retiros} />
            <div className="border-t border-border pt-1 mt-1 flex justify-between font-semibold">
              <span>Debería quedar en MP</span><span className="num">{fmt(data.esperado)}</span>
            </div>
            <Row label="Saldo real en MP" value={-data.real.total} muted />
          </div>
          <div className={`mt-3 rounded-lg border p-3 flex items-center justify-between ${v.ok ? "border-green-600/40 bg-green-600/10" : data.descuadre > 0 ? "border-rose-500/40 bg-rose-500/10" : "border-amber-500/40 bg-amber-500/10"}`}>
            <span className="inline-flex items-center gap-2">
              {v.ok ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <AlertTriangle className={`h-5 w-5 ${v.cls}`} />}
              <span className={`text-[13px] font-semibold ${v.cls}`}>{v.label}</span>
            </span>
            <span className={`text-2xl font-bold num ${v.cls}`}>{hasReal ? fmt(Math.abs(data.descuadre)) : "—"}</span>
          </div>
          {!hasReal && <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2">Captura el saldo real de MP arriba para ver el descuadre.</p>}
          <p className="text-[10.5px] text-muted-foreground mt-2">
            <strong>Falta en MP</strong> = vendiste más de lo que retiraste/gastaste, pero no está en MP (dinero perdido). <strong>Retirado de más</strong> = sacaste más de lo que justifican las ventas.
          </p>
        </div>

        {/* Inventory = future income */}
        <div className="rounded-xl border border-border bg-card glass p-4 flex flex-col">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold inline-flex items-center gap-1"><Package className="h-3.5 w-3.5" /> Inventario por vender</p>
          <p className="text-3xl font-bold num margin-good mt-1">{fmt(data.inventarioValor)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">{data.unidades.toLocaleString("es-MX")} unidades · a precio de listado ML</p>
          <p className="text-[11px] text-muted-foreground mt-auto pt-2">Ingreso <strong>futuro</strong> — cuánto entrará cuando vendas el stock actual. No cuenta en el descuadre.</p>
        </div>
      </div>

      {/* Per-group table */}
      <div className="rounded-xl border border-border bg-card glass overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-[13px] font-semibold">Por grupo · ¿de dónde falta dinero?</p>
          <p className="text-[11px] text-muted-foreground">El saldo real de MP se reparte proporcional a lo que cada grupo debería tener. Click una fila para ver productos.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left font-medium px-3 py-1.5">Grupo</th>
                <th className="text-right font-medium px-2 py-1.5">Vendido</th>
                <th className="text-right font-medium px-2 py-1.5">Gastos</th>
                <th className="text-right font-medium px-2 py-1.5">Retiros</th>
                <th className="text-right font-medium px-2 py-1.5">Debe en MP</th>
                <th className="text-right font-medium px-3 py-1.5">Descuadre</th>
                <th className="text-right font-medium px-3 py-1.5">Inventario</th>
              </tr>
            </thead>
            <tbody>
              {data.byGroup.map((g) => {
                const gv = verdict(g.descuadre);
                const key = g.groupId ?? "none";
                const isOpen = open[key];
                return (
                  <Fragment key={key}>
                    <tr className="border-b border-border/50 hover:bg-muted/30 cursor-pointer" onClick={() => setOpen((o) => ({ ...o, [key]: !o[key] }))}>
                      <td className="px-3 py-1.5">
                        <span className="inline-flex items-center gap-1.5">
                          <ChevronRight className={`h-3 w-3 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: g.groupColor }} />
                          <span className="font-medium">{g.groupName}</span>
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-right num">{fmt(g.vendido)}</td>
                      <td className="px-2 py-1.5 text-right num">{g.gastos ? `-${fmt(g.gastos)}` : "—"}</td>
                      <td className="px-2 py-1.5 text-right num">{g.retiros ? `-${fmt(g.retiros)}` : "—"}</td>
                      <td className="px-2 py-1.5 text-right num text-muted-foreground">{fmt(g.esperado)}</td>
                      <td className={`px-3 py-1.5 text-right num font-semibold ${gv.ok ? "text-muted-foreground" : gv.cls}`}>
                        {gv.ok ? "✓" : `${gv.label === "Falta en MP" ? "falta" : "de más"} ${fmt(Math.abs(g.descuadre))}`}
                      </td>
                      <td className="px-3 py-1.5 text-right num margin-good">{g.inventarioValor ? fmt(g.inventarioValor) : "—"}</td>
                    </tr>
                    {isOpen && g.products.map((p) => (
                      <tr key={`${key}-${p.productId ?? "np"}`} className="border-b border-border/30 bg-muted/10 text-[10.5px]">
                        <td className="px-3 py-1 pl-10 text-muted-foreground">{p.productName}</td>
                        <td className="px-2 py-1 text-right num">{p.vendido ? fmt(p.vendido) : "—"}</td>
                        <td className="px-2 py-1" colSpan={3} />
                        <td className="px-3 py-1 text-right num text-muted-foreground">{p.unidades.toLocaleString("es-MX")} u</td>
                        <td className="px-3 py-1 text-right num margin-good">{p.inventarioValor ? fmt(p.inventarioValor) : "—"}</td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-semibold">
                <td className="px-3 py-1.5">Total</td>
                <td className="px-2 py-1.5 text-right num">{fmt(data.vendido)}</td>
                <td className="px-2 py-1.5 text-right num">{data.gastos ? `-${fmt(data.gastos)}` : "—"}</td>
                <td className="px-2 py-1.5 text-right num">{data.retiros ? `-${fmt(data.retiros)}` : "—"}</td>
                <td className="px-2 py-1.5 text-right num">{fmt(data.esperado)}</td>
                <td className={`px-3 py-1.5 text-right num ${v.cls}`}>{hasReal ? (v.ok ? "✓" : fmt(Math.abs(data.descuadre))) : "—"}</td>
                <td className="px-3 py-1.5 text-right num margin-good">{fmt(data.inventarioValor)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, sign, muted }: { label: string; value: number; sign?: string; muted?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`num ${muted ? "text-muted-foreground" : ""}`}>{sign && value >= 0 ? sign : ""}{fmt(value)}</span>
    </div>
  );
}
