"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, TrendingUp, TrendingDown, DollarSign, Percent } from "lucide-react";

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
    <div className="space-y-6">
      {/* KPI Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-md p-2 bg-green-100 dark:bg-green-900/30">
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{fmt(totals.totalProfit)}</p>
                <p className="text-xs text-muted-foreground">Utilidad Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-md p-2 bg-blue-100 dark:bg-blue-900/30">
                <Percent className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totals.avgMargin.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Margen Promedio</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-md p-2 bg-purple-100 dark:bg-purple-900/30">
                <TrendingUp className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{fmt(totals.totalRevenue)}</p>
                <p className="text-xs text-muted-foreground">Ingresos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-md p-2 bg-amber-100 dark:bg-amber-900/30">
                <TrendingDown className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totals.totalSales}</p>
                <p className="text-xs text-muted-foreground">Ventas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <button onClick={() => setFilterMargin("all")} className={`px-3 py-1.5 text-sm rounded-md ${filterMargin === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>Todos</button>
          <button onClick={() => setFilterMargin("positive")} className={`px-3 py-1.5 text-sm rounded-md ${filterMargin === "positive" ? "bg-green-600 text-white" : "bg-muted text-muted-foreground"}`}>Rentables</button>
          <button onClick={() => setFilterMargin("negative")} className={`px-3 py-1.5 text-sm rounded-md ${filterMargin === "negative" ? "bg-red-600 text-white" : "bg-muted text-muted-foreground"}`}>Sin Margen</button>
        </div>
        <div className="flex gap-2">
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
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Pack</th>
                  <th className="text-right p-3 font-medium">Precio</th>
                  <th className="text-right p-3 font-medium">Costo Prod.</th>
                  <th className="text-right p-3 font-medium">Costos Adic.</th>
                  <th className="text-right p-3 font-medium">Comision ML</th>
                  <th className="text-right p-3 font-medium">Envio</th>
                  <th className="text-right p-3 font-medium">Utilidad</th>
                  <th className="text-right p-3 font-medium">Margen</th>
                  <th className="text-right p-3 font-medium">Ventas</th>
                  <th className="text-right p-3 font-medium">Util. Total</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id} className="border-b hover:bg-muted/30">
                    <td className="p-3">
                      <div className="font-medium text-xs">{d.name.substring(0, 50)}</div>
                      <div className="text-xs text-muted-foreground font-mono">{d.sku}</div>
                    </td>
                    <td className="text-right p-3 tabular-nums">{fmt(d.salePrice)}</td>
                    <td className="text-right p-3 tabular-nums">{d.productCost > 0 ? fmt(d.productCost) : <span className="text-muted-foreground">-</span>}</td>
                    <td className="text-right p-3 tabular-nums">
                      {d.additionalCosts > 0 ? (
                        <span title={d.costDetails.map((c) => `${c.category}: $${c.amount}`).join(", ")}>{fmt(d.additionalCosts)}</span>
                      ) : <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="text-right p-3 tabular-nums text-red-600 dark:text-red-400">{fmt(d.avgCommission)}</td>
                    <td className="text-right p-3 tabular-nums text-red-600 dark:text-red-400">{fmt(d.avgShipping)}</td>
                    <td className="text-right p-3 tabular-nums">
                      <span className={d.profit > 0 ? "text-green-600 dark:text-green-400 font-semibold" : "text-red-600 dark:text-red-400 font-semibold"}>
                        {fmt(d.profit)}
                      </span>
                    </td>
                    <td className="text-right p-3">
                      <Badge variant={d.margin > 20 ? "default" : d.margin > 0 ? "secondary" : "destructive"} className="text-xs">
                        {d.margin.toFixed(1)}%
                      </Badge>
                    </td>
                    <td className="text-right p-3 tabular-nums">{d.salesCount}</td>
                    <td className="text-right p-3 tabular-nums font-semibold">
                      <span className={d.totalProfit > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                        {fmt(d.totalProfit)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">No se encontraron packs.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
