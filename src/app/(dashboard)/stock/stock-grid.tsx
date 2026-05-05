"use client";

import { useState, useMemo } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Package, Layers, Box, AlertTriangle, Search, X } from "lucide-react";
import type { StockProduct } from "./page";

interface StockGroup {
  id: string;
  name: string;
  color: string;
  productIds: string[];
}

interface StockPack {
  id: string;
  sku: string;
  name: string;
  productIds: string[];
}

interface StockGridProps {
  products: StockProduct[];
  brands: string[];
  groups: StockGroup[];
  packs: StockPack[];
  totalProducts: number;
  totalVariants: number;
  totalUnits: number;
  lowStockAlerts: number;
}

export function StockGrid({
  products,
  brands,
  groups,
  packs,
  totalProducts,
  totalVariants,
  totalUnits,
  lowStockAlerts,
}: StockGridProps) {
  const [activeBrand, setActiveBrand] = useState<string>("all");
  const [activeGroupIds, setActiveGroupIds] = useState<Set<string>>(new Set());
  const [selectedPackIds, setSelectedPackIds] = useState<string[]>([]);
  const [showPacks, setShowPacks] = useState(false);
  const [packSearch, setPackSearch] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "stock" | "brand">("name");

  function toggleGroup(groupId: string) {
    const next = new Set(activeGroupIds);
    if (next.has(groupId)) {
      next.delete(groupId);
    } else {
      next.add(groupId);
    }
    setActiveGroupIds(next);
  }

  function togglePack(id: string) {
    setSelectedPackIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function clearFilters() {
    setActiveBrand("all");
    setActiveGroupIds(new Set());
    setSelectedPackIds([]);
    setSearch("");
    setPackSearch("");
  }

  const hasFilters = activeBrand !== "all" || activeGroupIds.size > 0 || selectedPackIds.length > 0 || search.trim() !== "";

  const filtered = useMemo(() => {
    let result = products;

    // Group filter — collect product IDs from active groups
    if (activeGroupIds.size > 0) {
      const groupProductIds = new Set<string>();
      for (const gid of activeGroupIds) {
        const g = groups.find((gr) => gr.id === gid);
        if (g) g.productIds.forEach((pid) => groupProductIds.add(pid));
      }
      result = result.filter((p) => groupProductIds.has(p.id));
    }

    // Pack filter — show products that appear in selected packs
    if (selectedPackIds.length > 0) {
      const packProductIds = new Set<string>();
      for (const pid of selectedPackIds) {
        const pk = packs.find((p) => p.id === pid);
        if (pk) pk.productIds.forEach((id) => packProductIds.add(id));
      }
      result = result.filter((p) => packProductIds.has(p.id));
    }

    // Brand filter
    if (activeBrand !== "all") {
      result = result.filter((p) => p.brand === activeBrand);
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.supplierCode.toLowerCase().includes(q)
      );
    }

    // Sort
    switch (sortBy) {
      case "name":
        result = [...result].sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "stock":
        result = [...result].sort((a, b) => b.totalStock - a.totalStock);
        break;
      case "brand":
        result = [...result].sort((a, b) =>
          (a.brand || "").localeCompare(b.brand || "")
        );
        break;
    }

    return result;
  }, [products, groups, packs, activeBrand, activeGroupIds, selectedPackIds, search, sortBy]);

  const filteredPacks = packs.filter(
    (p) => !packSearch || p.name.toLowerCase().includes(packSearch.toLowerCase()) || p.sku.toLowerCase().includes(packSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-md p-2 bg-blue-100 dark:bg-blue-900/30">
                <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalProducts}</p>
                <p className="text-xs text-muted-foreground">Productos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-md p-2 bg-purple-100 dark:bg-purple-900/30">
                <Layers className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalVariants}</p>
                <p className="text-xs text-muted-foreground">Variantes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-md p-2 bg-green-100 dark:bg-green-900/30">
                <Box className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalUnits}</p>
                <p className="text-xs text-muted-foreground">Unidades</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-md p-2 bg-amber-100 dark:bg-amber-900/30">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{lowStockAlerts}</p>
                <p className="text-xs text-muted-foreground">Stock bajo</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          {/* Row 1: Groups */}
          {groups.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Grupos</span>
                {hasFilters && (
                  <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground">
                    Limpiar filtros
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {groups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => toggleGroup(g.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                      activeGroupIds.has(g.id)
                        ? "ring-2 ring-offset-1 ring-offset-background"
                        : "opacity-75 hover:opacity-100"
                    }`}
                    style={{
                      borderColor: g.color,
                      backgroundColor: activeGroupIds.has(g.id) ? g.color + "20" : "transparent",
                      color: g.color,
                      ...(activeGroupIds.has(g.id) && { boxShadow: `0 0 0 2px ${g.color}40` }),
                    }}
                  >
                    <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />
                    {g.name}
                    <span className="text-[10px] opacity-70">({g.productIds.length})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Row 2: Brand tabs + Pack selector + Search + Sort */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveBrand("all")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeBrand === "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                Todos
              </button>
              {brands.map((brand) => (
                <button
                  key={brand}
                  onClick={() => setActiveBrand(brand)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeBrand === brand
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {brand}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              {/* Pack multi-select */}
              <div className="relative">
                <button
                  onClick={() => setShowPacks(!showPacks)}
                  className="flex items-center justify-between h-9 rounded-md border border-input bg-background px-2 text-sm min-w-[140px]"
                >
                  <span className="truncate text-xs">
                    {selectedPackIds.length > 0
                      ? `${selectedPackIds.length} pack${selectedPackIds.length > 1 ? "s" : ""}`
                      : "Filtrar por pack..."}
                  </span>
                  <span className="text-xs text-muted-foreground ml-1">▼</span>
                </button>
                {showPacks && (
                  <div className="absolute z-50 mt-1 rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto w-56 right-0">
                    <div className="p-2 sticky top-0 bg-popover border-b">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                        <Input
                          placeholder="Buscar pack..."
                          value={packSearch}
                          onChange={(e) => setPackSearch(e.target.value)}
                          className="h-7 pl-7 text-xs"
                        />
                      </div>
                    </div>
                    {filteredPacks.slice(0, 30).map((p) => (
                      <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={selectedPackIds.includes(p.id)}
                          onChange={() => togglePack(p.id)}
                          className="rounded"
                        />
                        <span className="font-mono text-xs text-muted-foreground w-16 truncate">{p.sku}</span>
                        <span className="truncate text-xs">{p.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar producto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 w-48"
                />
              </div>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as "name" | "stock" | "brand")}>
                <SelectTrigger className="h-9 w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Nombre</SelectItem>
                  <SelectItem value="stock">Stock</SelectItem>
                  <SelectItem value="brand">Marca</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active filter badges */}
          {(selectedPackIds.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {selectedPackIds.map((id) => {
                const pack = packs.find((p) => p.id === id);
                return (
                  <Badge key={id} variant="secondary" className="gap-1 text-xs cursor-pointer" onClick={() => togglePack(id)}>
                    {pack?.sku || id.slice(-6)}
                    <X className="h-3 w-3" />
                  </Badge>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product Cards Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No se encontraron productos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((product) => {
            const maxVariantStock = Math.max(...product.variants.map((v) => v.stock), 1);

            return (
              <Card key={product.id} className="transition-all hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm truncate">{product.name}</h3>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">
                        {product.supplierCode}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {product.brand && (
                        <Badge variant="secondary" className="text-xs">
                          {product.brand}
                        </Badge>
                      )}
                      <StatusDot status={product.status} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Total stock */}
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`text-3xl font-bold ${
                        product.status === "healthy"
                          ? "text-green-600 dark:text-green-400"
                          : product.status === "low"
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {product.totalStock}
                    </span>
                    <span className="text-xs text-muted-foreground">unidades</span>
                  </div>

                  {/* Variant breakdown */}
                  <div className="space-y-2">
                    {product.variants.map((variant) => (
                      <div key={variant.id} className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full shrink-0 border border-black/10"
                          style={{ backgroundColor: variant.hex }}
                        />
                        <span className="text-xs text-muted-foreground min-w-[60px] truncate">
                          {variant.label}
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              variant.stock === 0
                                ? "bg-red-400 dark:bg-red-500"
                                : variant.stock <= 5
                                ? "bg-amber-400 dark:bg-amber-500"
                                : "bg-green-400 dark:bg-green-500"
                            }`}
                            style={{
                              width: `${Math.max(
                                (variant.stock / maxVariantStock) * 100,
                                variant.stock > 0 ? 8 : 0
                              )}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs font-medium w-6 text-right tabular-nums">
                          {variant.stock}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: "healthy" | "low" | "out" }) {
  const colors = {
    healthy: "bg-green-500",
    low: "bg-amber-500",
    out: "bg-red-500",
  };

  const labels = {
    healthy: "Stock OK",
    low: "Stock bajo",
    out: "Sin stock",
  };

  return (
    <div className="flex items-center gap-1" title={labels[status]}>
      <div className={`h-2.5 w-2.5 rounded-full ${colors[status]}`} />
    </div>
  );
}
