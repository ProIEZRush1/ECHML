"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface PackProfit {
  id: string;
  sku: string;
  name: string;
  salePrice: number;
  productCost: number;
  additionalCosts: number;
  costDetails: Array<{ id: string; category: string; amount: number }>;
  avgCommission: number;
  avgShipping: number;
  profit: number;
  margin: number;
  salesCount: number;
  totalProfit: number;
}

interface RentabilidadTableProps {
  data: PackProfit[];
}

export function RentabilidadTable({ data }: RentabilidadTableProps) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"margin" | "profit" | "sales" | "name">("margin");
  const [filterMargin, setFilterMargin] = useState<"all" | "positive" | "negative">("all");

  const filtered = useMemo(() => {
    let result = data.filter((d) => d.salesCount > 0 || d.salePrice > 0);

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((d) => d.name.toLowerCase().includes(q) || d.sku.toLowerCase().includes(q));
    }

    if (filterMargin === "positive") result = result.filter((d) => d.profit > 0);
    if (filterMargin === "negative") result = result.filter((d) => d.profit <= 0);

    switch (sortBy) {
      case "margin": result = [...result].sort((a, b) => b.margin - a.margin); break;
      case "profit": result = [...result].sort((a, b) => b.totalProfit - a.totalProfit); break;
      case "sales": result = [...result].sort((a, b) => b.salesCount - a.salesCount); break;
      case "name": result = [...result].sort((a, b) => a.name.localeCompare(b.name)); break;
    }

    return result;
  }, [data, search, sortBy, filterMargin]);

  const totals = useMemo(() => {
    const withSales = data.filter((d) => d.salesCount > 0);
    return {
      totalRevenue: withSales.reduce((sum, d) => sum + d.salePrice * d.salesCount, 0),
      totalProfit: withSales.reduce((sum, d) => sum + d.totalProfit, 0),
      totalSales: withSales.reduce((sum, d) => sum + d.salesCount, 0),
      avgMargin: withSales.length > 0
        ? withSales.reduce((sum, d) => sum + d.margin, 0) / withSales.length
        : 0,
    };
  }, [data]);

  const fmt = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-5">
      {/* KPI Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-[9px] border border-border bg-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Utilidad Total</p>
          <p className={`text-2xl font-bold mt-1 num ${totals.totalProfit >= 0 ? "margin-good" : "margin-bad"}`}>{fmt(totals.totalProfit)}</p>
        </div>
        <div className="rounded-[9px] border border-border bg-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Margen Promedio</p>
          <p className={`text-2xl font-bold mt-1 num ${totals.avgMargin > 20 ? "margin-good" : totals.avgMargin > 0 ? "margin-warn" : "margin-bad"}`}>{totals.avgMargin.toFixed(1)}%</p>
        </div>
        <div className="rounded-[9px] border border-border bg-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Ingresos</p>
          <p className="text-2xl font-bold mt-1 num">{fmt(totals.totalRevenue)}</p>
        </div>
        <div className="rounded-[9px] border border-border bg-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Ventas</p>
          <p className="text-2xl font-bold mt-1 num">{totals.totalSales}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="filt-bar">
        <span className="lbl">Margen</span>
        <div className="pillgroup">
          <button onClick={() => setFilterMargin("all")} className={filterMargin === "all" ? "on" : ""}>Todos</button>
          <button onClick={() => setFilterMargin("positive")} className={filterMargin === "positive" ? "on" : ""}>Rentables</button>
          <button onClick={() => setFilterMargin("negative")} className={filterMargin === "negative" ? "on" : ""}>Sin Margen</button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar pack..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 w-48" />
          </div>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="h-9 rounded-md border bg-background px-2 text-sm">
            <option value="margin">Margen %</option>
            <option value="profit">Utilidad Total</option>
            <option value="sales">Ventas</option>
            <option value="name">Nombre</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-[9px] border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Pack</th>
                <th className="text-right p-3 text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Precio</th>
                <th className="text-right p-3 text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Costo Prod.</th>
                <th className="text-right p-3 text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Costos Adic.</th>
                <th className="text-right p-3 text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Comision ML</th>
                <th className="text-right p-3 text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Envio</th>
                <th className="text-right p-3 text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Utilidad</th>
                <th className="text-right p-3 text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Margen</th>
                <th className="text-right p-3 text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Ventas</th>
                <th className="text-right p-3 text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Util. Total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => {
                const marginClass = d.margin > 20 ? "margin-good" : d.margin > 0 ? "margin-warn" : "margin-bad";
                return (
                  <tr key={d.id} className="border-b hover:bg-muted/30">
                    <td className="p-3">
                      <div className="font-medium text-[12px]">{d.name.substring(0, 50)}</div>
                      <div className="mono text-[11px] text-muted-foreground">{d.sku}</div>
                    </td>
                    <td className="text-right p-3 num text-[12.5px]">{fmt(d.salePrice)}</td>
                    <td className="text-right p-3 num text-[12.5px]">{d.productCost > 0 ? fmt(d.productCost) : <span className="text-muted-foreground">-</span>}</td>
                    <td className="text-right p-3 num text-[12.5px]">
                      {d.additionalCosts > 0 ? (
                        <span title={d.costDetails.map((c) => `${c.category}: $${c.amount}`).join(", ")}>{fmt(d.additionalCosts)}</span>
                      ) : <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="text-right p-3 num text-[12.5px] margin-bad">{fmt(d.avgCommission)}</td>
                    <td className="text-right p-3 num text-[12.5px] margin-bad">{fmt(d.avgShipping)}</td>
                    <td className="text-right p-3 num">
                      <span className={`font-semibold text-[12.5px] ${d.profit > 0 ? "margin-good" : "margin-bad"}`}>
                        {fmt(d.profit)}
                      </span>
                    </td>
                    <td className="text-right p-3">
                      <span className={`margin-pill ${marginClass}`}>
                        {d.margin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="text-right p-3 num text-[12.5px]">{d.salesCount}</td>
                    <td className="text-right p-3 num font-semibold">
                      <span className={`text-[12.5px] ${d.totalProfit > 0 ? "margin-good" : "margin-bad"}`}>
                        {fmt(d.totalProfit)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">No se encontraron packs.</div>
        )}
      </div>
    </div>
  );
}
