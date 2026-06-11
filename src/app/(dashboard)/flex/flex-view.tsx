"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency as fmt } from "@/lib/utils";
import type { FlexData } from "@/lib/finance/flex";

export function FlexView({ data }: { data: FlexData }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [paying, setPaying] = useState(false);

  async function pay() {
    const amt = Number(amount);
    if (!amt || amt <= 0) return;
    setPaying(true);
    try {
      const r = await fetch("/api/flex-pay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: amt }) });
      if (r.ok) { setAmount(""); router.refresh(); }
    } finally { setPaying(false); }
  }

  const cards: { label: string; value: string; sub: string; good?: boolean; bad?: boolean }[] = [
    { label: "Servicios Flex", value: data.count.toLocaleString("es-MX"), sub: `${data.unpaidCount} sin pagar` },
    { label: "Cargos (bruto)", value: fmt(data.grossCost), sub: `lo que cobra la paquetería ($115/orden)` },
    { label: "Bonificación ML", value: fmt(data.bonificacion), sub: "crédito de ML (aparte)", good: true },
    { label: "Costo neto", value: fmt(data.netCost), sub: "bruto − bonificación" },
    { label: "Abonado", value: fmt(data.paid), sub: "lo que pagaste", good: true },
    { label: "Saldo (debes)", value: fmt(data.balance), sub: "cargos − abonado", bad: data.balance > 0.5 },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card glass p-3 flex flex-col">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{c.label}</p>
            <p className={`text-xl font-bold num mt-1 ${c.bad ? "text-red-500" : c.good ? "margin-good" : ""}`}>{c.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card glass p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-[11px] text-muted-foreground">Registrar pago a la paquetería</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="block w-44 mt-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm" />
          </div>
          <button onClick={pay} disabled={paying} className="rounded-md bg-amber-500/90 hover:bg-amber-500 text-black font-semibold px-4 py-1.5 text-sm disabled:opacity-50">{paying ? "..." : "Registrar pago"}</button>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          <strong>Para cuadrar con el portal de la paquetería:</strong> ellos cobran <strong>bruto $115 por orden</strong> (= sus &quot;Cargos&quot;) y <em>no</em> restan la bonificación de ML.
          Compara su &quot;TOTAL CARGOS&quot; contra <strong>Cargos (bruto)</strong> aquí, y su &quot;TOTAL ABONADO&quot; contra <strong>Abonado</strong>.
          Si su abonado es menor, les falta registrar un pago tuyo. La <strong>bonificación de ML</strong> y el <strong>costo neto</strong> son tuyos (no del portal).
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card glass p-4 overflow-x-auto">
        <h3 className="text-sm font-semibold mb-2">Por grupo · solo los que usan Flex</h3>
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="text-[11px] text-muted-foreground border-b border-border">
              <th className="text-left py-1.5">Grupo</th>
              <th className="text-right">Servicios</th>
              <th className="text-right">Cargos</th>
              <th className="text-right">Bonif. ML</th>
              <th className="text-right">Costo neto</th>
              <th className="text-right">Abonado</th>
              <th className="text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {data.byGroup.map((g) => (
              <tr key={g.groupId ?? "none"} className="border-b border-border/40">
                <td className="py-1.5"><span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: g.groupColor }} />{g.groupName}</td>
                <td className="text-right num">{g.count}</td>
                <td className="text-right num">{fmt(g.grossCost)}</td>
                <td className="text-right num margin-good">{g.bonificacion ? fmt(g.bonificacion) : "—"}</td>
                <td className="text-right num">{fmt(g.netCost)}</td>
                <td className="text-right num">{fmt(g.paid)}</td>
                <td className={`text-right num ${g.balance > 0.5 ? "text-red-500" : ""}`}>{fmt(g.balance)}</td>
              </tr>
            ))}
            {data.byGroup.length === 0 && <tr><td colSpan={7} className="py-3 text-center text-muted-foreground text-[12px]">Sin órdenes Flex.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card glass p-4">
          <h3 className="text-sm font-semibold mb-2">Pagos registrados</h3>
          {data.payments.length === 0 ? <p className="text-[12px] text-muted-foreground">Sin pagos.</p> : (
            <ul className="space-y-1 text-[12px] max-h-72 overflow-auto">
              {data.payments.map((p, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="text-muted-foreground truncate">{new Date(p.date).toLocaleDateString("es-MX")} · {p.concept}</span>
                  <span className="num margin-good whitespace-nowrap">{fmt(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card glass p-4">
          <h3 className="text-sm font-semibold mb-2">Órdenes Flex recientes</h3>
          <ul className="space-y-1 text-[12px] max-h-72 overflow-auto">
            {data.orders.map((o, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="text-muted-foreground truncate"><span className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle" style={{ background: o.groupColor }} />{new Date(o.date).toLocaleDateString("es-MX")} · {o.mlOrderId ?? "—"}</span>
                <span className="num whitespace-nowrap">{fmt(o.cost)} {o.paid ? <span className="margin-good">✓</span> : <span className="text-red-500">•</span>}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
