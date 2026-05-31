"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Search, ExternalLink, ArrowUpDown, TrendingUp, TrendingDown, Package, Undo2 } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { OrderRow, OrderSummary, EstadoKind } from "@/lib/finance/order-economics";

const ESTADO_CSS: Record<EstadoKind, string> = {
  ok: "tx-pill sale",
  transito: "tx-pill shipping",
  pendiente: "tx-pill expense",
  devuelto: "tx-pill fee",
  parcial: "tx-pill fee",
  cancelado: "tx-pill expense",
};

const STATUS_TABS: { label: string; value: string; kinds: EstadoKind[] }[] = [
  { label: "Todos", value: "", kinds: [] },
  { label: "Entregados", value: "ok", kinds: ["ok"] },
  { label: "En camino", value: "transito", kinds: ["transito", "pendiente"] },
  { label: "Devoluciones", value: "devuelto", kinds: ["devuelto"] },
  { label: "Reembolso parcial", value: "parcial", kinds: ["parcial"] },
  { label: "Cancelados", value: "cancelado", kinds: ["cancelado"] },
];

const LOGISTIC: Record<string, { label: string; css: string }> = {
  fulfillment: { label: "FULL", css: "bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400" },
  self_service: { label: "FLEX", css: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" },
  xd_drop_off: { label: "ME2", css: "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400" },
};

const LABEL_DOT: Record<string, string> = {
  Blanco: "bg-white border border-gray-300", Negro: "bg-black", Gris: "bg-gray-400",
  Multicolor: "bg-gradient-to-r from-blue-500 via-green-500 to-pink-500",
  Azul: "bg-blue-500", Verde: "bg-green-500", Rosa: "bg-pink-400", Morado: "bg-purple-500",
};
const COLOR_DOT: Record<string, string> = { AZUL: "bg-blue-500", VERDE: "bg-green-500", ROSA: "bg-pink-400", MORADO: "bg-purple-500" };

const PAGE_SIZE = 50;
type SortKey = "date" | "vendido" | "neto" | "devolucion" | "envioExtra";

export function PedidosContent({ rows, summary, from, to }: { rows: OrderRow[]; summary: OrderSummary; from: string; to: string }) {
  const router = useRouter();
  const [dFrom, setDFrom] = useState(from);
  const [dTo, setDTo] = useState(to);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const applyDates = () => router.push(`/pedidos?from=${dFrom}&to=${dTo}`);

  const filtered = useMemo(() => {
    const tabKinds = STATUS_TABS.find((t) => t.value === tab)?.kinds ?? [];
    const needle = q.trim().toLowerCase();
    let r = rows.filter((row) => {
      if (tabKinds.length && !tabKinds.includes(row.estadoKind)) return false;
      if (needle) {
        const hay = `${row.title} ${row.sku ?? ""} ${row.mlOrderId} ${row.buyerNickname ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    r = [...r].sort((a, b) => {
      let av: number | string, bv: number | string;
      if (sortKey === "date") { av = a.date; bv = b.date; }
      else { av = a[sortKey]; bv = b[sortKey]; }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [rows, q, tab, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
    setPage(1);
  };

  const SortTh = ({ k, label, cls = "" }: { k: SortKey; label: string; cls?: string }) => (
    <th className={`px-2 py-1.5 text-[11px] uppercase tracking-wider cursor-pointer select-none whitespace-nowrap ${cls}`} onClick={() => toggleSort(k)}>
      <span className="inline-flex items-center gap-1">{label}<ArrowUpDown className={`h-3 w-3 ${sortKey === k ? "text-accent" : "opacity-30"}`} /></span>
    </th>
  );

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Vendido" value={formatCurrency(summary.vendido)} hint={`${summary.count} pedidos`} icon={<Package className="h-4 w-4" />} />
        <Kpi label="Devoluciones" value={`-${formatCurrency(summary.devoluciones)}`} hint={`${summary.devolucionesCount} órdenes`} tone="bad" icon={<Undo2 className="h-4 w-4" />} />
        <Kpi label="Envío extra (cobrado por ML)" value={`-${formatCurrency(summary.envioExtra)}`} hint="flete de devoluciones" tone="bad" />
        <Kpi
          label={summary.neto >= 0 ? "Neto · ganando" : "Neto · perdiendo"}
          value={formatCurrency(summary.neto)}
          hint="vendido − comis − envío − costo − devol − extra"
          tone={summary.neto >= 0 ? "good" : "bad"}
          icon={summary.neto >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          big
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">Desde</span>
          <input type="date" value={dFrom} onChange={(e) => setDFrom(e.target.value)} className="rounded border border-border bg-background px-2 py-1 text-[12px]" />
          <span className="text-[11px] text-muted-foreground">Hasta</span>
          <input type="date" value={dTo} onChange={(e) => setDTo(e.target.value)} className="rounded border border-border bg-background px-2 py-1 text-[12px]" />
          <button onClick={applyDates} className="rounded bg-accent/15 hover:bg-accent/25 text-accent text-[12px] px-2.5 py-1">Aplicar</button>
        </div>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Buscar producto, SKU, orden, comprador…" className="w-full rounded border border-border bg-background pl-7 pr-2 py-1 text-[12px]" />
        </div>
      </div>

      <div className="filt-bar overflow-x-auto">
        <span className="lbl">Estado</span>
        {STATUS_TABS.map((t) => (
          <button key={t.value} onClick={() => { setTab(t.value); setPage(1); }} className={`filt-input ${tab === t.value ? "active" : ""}`}>{t.label}</button>
        ))}
      </div>

      <div className="text-[12px] text-muted-foreground">{filtered.length} pedidos {tab || q ? "(filtrado)" : ""}</div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card glass overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground border-b border-border">
                <SortTh k="date" label="Fecha" cls="text-left" />
                <th className="px-1"></th>
                <th className="px-2 py-1.5 text-[11px] uppercase tracking-wider text-left">Producto</th>
                <th className="px-2 py-1.5 text-[11px] uppercase tracking-wider text-center">Cant</th>
                <th className="px-2 py-1.5 text-[11px] uppercase tracking-wider text-left">Estado</th>
                <SortTh k="vendido" label="Vendido" cls="text-right" />
                <th className="px-2 py-1.5 text-[11px] uppercase tracking-wider text-right">Comisión</th>
                <th className="px-2 py-1.5 text-[11px] uppercase tracking-wider text-right">Envío</th>
                <th className="px-2 py-1.5 text-[11px] uppercase tracking-wider text-right">Costo prod</th>
                <SortTh k="devolucion" label="Devolución" cls="text-right" />
                <SortTh k="envioExtra" label="Envío extra" cls="text-right" />
                <SortTh k="neto" label="Neto" cls="text-right" />
                <th className="px-1"></th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr key={row.id} className={`border-b border-border/50 last:border-0 hover:bg-muted/40 ${row.estadoKind === "devuelto" ? "bg-rose-500/[0.04]" : ""}`}>
                  <td className="px-2 py-1.5 text-[11.5px] text-muted-foreground whitespace-nowrap">{formatDateTime(row.date)}</td>
                  <td className="px-1">
                    {row.imageUrl ? (
                      <Image src={row.imageUrl} alt="" width={28} height={28} className="h-7 w-7 rounded object-cover border bg-muted" unoptimized />
                    ) : <div className="h-7 w-7 rounded bg-muted" />}
                  </td>
                  <td className="px-2 py-1.5 max-w-[260px]">
                    <span className="block truncate text-[12px]" title={row.title}>{row.title}</span>
                    <span className="flex items-center gap-1.5 mt-0.5">
                      {row.sku && <span className="mono text-[10px] text-muted-foreground">{row.sku}</span>}
                      {row.variantDots.map((d, i) => {
                        const cls = (d.color && COLOR_DOT[d.color]) || (d.label && LABEL_DOT[d.label.split(" / ")[0]]);
                        return cls ? <span key={i} className={`inline-block h-2 w-2 rounded-full shrink-0 ${cls}`} title={d.label || ""} /> : null;
                      })}
                      {row.logisticType && LOGISTIC[row.logisticType] && (
                        <span className={`text-[9px] font-semibold px-1 py-0.5 rounded ${LOGISTIC[row.logisticType].css}`}>{LOGISTIC[row.logisticType].label}</span>
                      )}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-center num text-[12px]">{row.quantity}</td>
                  <td className="px-2 py-1.5"><span className={ESTADO_CSS[row.estadoKind]}>{row.estado}</span></td>
                  <td className="px-2 py-1.5 text-right num text-[12px] font-medium">{formatCurrency(row.vendido)}</td>
                  <td className="px-2 py-1.5 text-right num text-[12px] text-muted-foreground">{row.comision ? `-${formatCurrency(row.comision)}` : "—"}</td>
                  <td className="px-2 py-1.5 text-right num text-[12px] text-muted-foreground">{row.envio ? `-${formatCurrency(row.envio)}` : "—"}</td>
                  <td className="px-2 py-1.5 text-right num text-[12px] text-muted-foreground">{row.costoProd ? `-${formatCurrency(row.costoProd)}` : (row.hasCostData ? "—" : "?")}</td>
                  <td className="px-2 py-1.5 text-right num text-[12px]">{row.devolucion ? <span className="margin-bad">-{formatCurrency(row.devolucion)}</span> : "—"}</td>
                  <td className="px-2 py-1.5 text-right num text-[12px]">{row.envioExtra ? <span className="margin-bad">-{formatCurrency(row.envioExtra)}</span> : "—"}</td>
                  <td className={`px-2 py-1.5 text-right num text-[12px] font-semibold ${row.neto >= 0 ? "margin-good" : "margin-bad"}`}>{formatCurrency(row.neto)}</td>
                  <td className="px-1 text-right">
                    <a href={`https://www.mercadolibre.com.mx/ventas/${row.mlOrderId}/detalle`} target="_blank" rel="noopener noreferrer" className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted" title="Ver en ML">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr><td colSpan={13} className="px-3 py-8 text-center text-[12px] text-muted-foreground">Sin pedidos en este filtro.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 text-[12px]">
          <button disabled={safePage <= 1} onClick={() => setPage((p) => p - 1)} className="filt-input disabled:opacity-40">Anterior</button>
          <span className="text-muted-foreground">Página {safePage} de {pageCount}</span>
          <button disabled={safePage >= pageCount} onClick={() => setPage((p) => p + 1)} className="filt-input disabled:opacity-40">Siguiente</button>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, hint, tone, icon, big }: { label: string; value: string; hint?: string; tone?: "good" | "bad"; icon?: React.ReactNode; big?: boolean }) {
  const toneCss = tone === "good" ? "margin-good" : tone === "bad" ? "margin-bad" : "";
  return (
    <div className={`rounded-xl border bg-card glass p-3.5 ${big ? (tone === "bad" ? "border-rose-500/40" : "border-green-600/40") : "border-border"}`}>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5">{icon}{label}</p>
      <p className={`text-xl font-bold mt-1 num ${toneCss}`}>{value}</p>
      {hint && <p className="text-[10.5px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}
