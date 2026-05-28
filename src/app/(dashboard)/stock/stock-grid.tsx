"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Package, Layers, Box, AlertTriangle, Search, X, Plus, Minus, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
  const router = useRouter();
  const [activeBrand, setActiveBrand] = useState<string>("all");
  const [activeGroupIds, setActiveGroupIds] = useState<Set<string>>(new Set());
  const [selectedPackIds, setSelectedPackIds] = useState<string[]>([]);
  const [showPacks, setShowPacks] = useState(false);
  const [packSearch, setPackSearch] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "stock" | "brand">("name");

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustVariant, setAdjustVariant] = useState<{ id: string; label: string; stock: number; productName: string } | null>(null);
  const [adjustDelta, setAdjustDelta] = useState(0);
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustSaving, setAdjustSaving] = useState(false);

  function openAdjust(variant: { id: string; label: string; stock: number }, productName: string) {
    setAdjustVariant({ ...variant, productName });
    setAdjustDelta(0);
    setAdjustReason("");
    setAdjustOpen(true);
  }

  async function handleAdjust() {
    if (!adjustVariant || adjustDelta === 0) return;
    setAdjustSaving(true);
    try {
      const newStock = adjustVariant.stock + adjustDelta;
      if (newStock < 0) { toast.error("Stock no puede ser negativo"); return; }
      const res = await fetch("/api/stock/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productVariantId: adjustVariant.id,
          newStock,
          reason: adjustReason || `Ajuste manual ${adjustDelta > 0 ? "+" : ""}${adjustDelta}`,
        }),
      });
      if (!res.ok) throw new Error("Error");
      toast.success(`Stock ajustado: ${adjustVariant.label} → ${newStock}`);
      setAdjustOpen(false);
      router.refresh();
    } catch {
      toast.error("Error al ajustar stock");
    } finally {
      setAdjustSaving(false);
    }
  }

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
    <div className="space-y-5">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: Package, value: totalProducts, label: "Productos", color: "oklch(0.55 0.12 230)" },
          { icon: Layers, value: totalVariants, label: "Variantes", color: "oklch(0.55 0.12 290)" },
          { icon: Box, value: totalUnits, label: "Unidades", color: "oklch(0.55 0.12 155)" },
          { icon: AlertTriangle, value: lowStockAlerts, label: "Stock bajo", color: "oklch(0.55 0.14 60)" },
        ].map(({ icon: Icon, value, label, color }) => (
          <div key={label} className="rounded-[9px] border border-border bg-card glass px-4 py-3 flex items-center gap-3">
            <div className="rounded-md p-2" style={{ background: `color-mix(in oklch, ${color} 14%, transparent)` }}>
              <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Groups row */}
        {groups.length > 0 && (
          <div className="filt-bar overflow-x-auto">
            <span className="lbl">Grupos</span>
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => toggleGroup(g.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
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
                <span className="sw" style={{ backgroundColor: g.color, width: 8, height: 8, margin: 0, border: 0 }} />
                {g.name}
                <span className="text-[10px] opacity-70">({g.productIds.length})</span>
              </button>
            ))}
            {hasFilters && (
              <button onClick={clearFilters} className="ml-auto text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                Limpiar
              </button>
            )}
          </div>
        )}

        {/* Brand + search + sort row */}
        <div className="filt-bar overflow-x-auto">
          <span className="lbl">Marca</span>
          <div className="pillgroup">
            <button className={activeBrand === "all" ? "on" : ""} onClick={() => setActiveBrand("all")}>
              Todos
            </button>
            {brands.map((brand) => (
              <button
                key={brand}
                className={activeBrand === brand ? "on" : ""}
                onClick={() => setActiveBrand(brand)}
              >
                {brand}
              </button>
            ))}
          </div>

          {/* Pack multi-select */}
          <div className="relative ml-auto">
            <button
              onClick={() => setShowPacks(!showPacks)}
              className="filt-input"
            >
              <Package className="h-3 w-3" />
              {selectedPackIds.length > 0
                ? `${selectedPackIds.length} pack${selectedPackIds.length > 1 ? "s" : ""}`
                : "Pack"}
              <span className="text-[10px]">&#x25BC;</span>
            </button>
            {showPacks && (
              <div className="absolute z-50 mt-1 rounded-[9px] border border-border bg-popover shadow-md max-h-48 overflow-y-auto w-56 right-0">
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
                    <span className="mono text-[11px] text-muted-foreground w-16 truncate">{p.sku}</span>
                    <span className="truncate text-xs">{p.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 w-40 text-xs"
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as "name" | "stock" | "brand")}>
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Nombre</SelectItem>
              <SelectItem value="stock">Stock</SelectItem>
              <SelectItem value="brand">Marca</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Active pack filter badges */}
        {selectedPackIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1">
            {selectedPackIds.map((id) => {
              const pack = packs.find((p) => p.id === id);
              return (
                <Badge key={id} variant="secondary" className="gap-1 text-[10px] cursor-pointer" onClick={() => togglePack(id)}>
                  {pack?.sku || id.slice(-6)}
                  <X className="h-3 w-3" />
                </Badge>
              );
            })}
          </div>
        )}
      </div>

      {/* Stock Matrix Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-sm">No se encontraron productos.</p>
        </div>
      ) : (
        <>
        {/* Desktop table */}
        <div className="rounded-[9px] border border-border bg-card glass overflow-x-auto hidden sm:block">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                  Producto
                </th>
                <th className="text-left px-3 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                  Marca
                </th>
                <th className="text-center px-3 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                  Total
                </th>
                <th className="text-center px-3 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em] min-w-[280px]">
                  Variantes
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <tr key={product.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-[13px] leading-tight">{product.name}</div>
                    <div className="mono text-[11px] text-muted-foreground mt-0.5">{product.supplierCode}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    {product.brand && (
                      <span className="tx-pill expense">{product.brand}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`mono text-[15px] font-bold ${
                      product.status === "out" ? "text-[oklch(0.58_0.16_22)]"
                        : product.status === "low" ? "text-[oklch(0.48_0.13_70)]"
                        : ""
                    }`}>
                      {product.totalStock}
                    </span>
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex gap-px">
                      {product.variants.map((variant) => {
                        const cellClass = variant.stock === 0
                          ? "zero"
                          : variant.stock <= 3
                          ? "low"
                          : "";
                        return (
                          <div
                            key={variant.id}
                            className={`stock-cell flex-1 rounded-[5px] ${cellClass} group/cell cursor-pointer relative`}
                            onClick={() => openAdjust(variant, product.name)}
                          >
                            <span className="q">{variant.stock}</span>
                            <span className="l flex items-center gap-1">
                              <span className="sw" style={{ backgroundColor: variant.hex, width: 7, height: 7, margin: 0 }} />
                              {variant.label}
                            </span>
                            <div className="absolute inset-0 rounded-[5px] bg-foreground/5 opacity-0 group-hover/cell:opacity-100 transition-opacity flex items-center justify-center gap-1">
                              <Minus className="h-3 w-3 text-muted-foreground" />
                              <Plus className="h-3 w-3 text-muted-foreground" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile card layout */}
        <div className="sm:hidden space-y-2">
          {filtered.map((product) => (
            <div key={product.id} className="rounded-[9px] border border-border bg-card glass p-3">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-medium text-[13px] leading-tight">{product.name}</div>
                  {product.brand && (
                    <span className="tx-pill expense mt-1 inline-block">{product.brand}</span>
                  )}
                </div>
                <span className={`mono text-lg font-bold ${
                  product.status === "out" ? "text-[oklch(0.58_0.16_22)]"
                    : product.status === "low" ? "text-[oklch(0.48_0.13_70)]"
                    : ""
                }`}>
                  {product.totalStock}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {product.variants.map((variant) => {
                  const cellClass = variant.stock === 0
                    ? "zero"
                    : variant.stock <= 3
                    ? "low"
                    : "";
                  return (
                    <div
                      key={variant.id}
                      className={`stock-cell rounded-[5px] ${cellClass} cursor-pointer`}
                      onClick={() => openAdjust(variant, product.name)}
                    >
                      <span className="q">{variant.stock}</span>
                      <span className="l flex items-center gap-1">
                        <span className="sw" style={{ backgroundColor: variant.hex, width: 7, height: 7, margin: 0 }} />
                        {variant.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        </>
      )}
      {/* Stock Adjustment Dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Ajustar Stock</DialogTitle>
          </DialogHeader>
          {adjustVariant && (
            <div className="space-y-4 py-2">
              <div className="text-sm">
                <span className="font-medium">{adjustVariant.productName}</span>
                <span className="text-muted-foreground"> — {adjustVariant.label}</span>
              </div>

              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => setAdjustDelta((d) => d - 1)}
                  className="h-10 w-10 rounded-full border border-border hover:bg-muted flex items-center justify-center transition-colors"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <div className="text-center min-w-[100px]">
                  <div className={`text-3xl font-bold mono ${adjustDelta > 0 ? "text-emerald-600" : adjustDelta < 0 ? "text-rose-600" : ""}`}>
                    {adjustDelta > 0 ? "+" : ""}{adjustDelta}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {adjustVariant.stock} → {adjustVariant.stock + adjustDelta}
                  </div>
                </div>
                <button
                  onClick={() => setAdjustDelta((d) => d + 1)}
                  className="h-10 w-10 rounded-full border border-border hover:bg-muted flex items-center justify-center transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <div>
                <Label htmlFor="adjust-reason">Razon (opcional)</Label>
                <Input
                  id="adjust-reason"
                  placeholder="Ej: Devolucion, error conteo..."
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdjust} disabled={adjustSaving || adjustDelta === 0}>
              {adjustSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Ajustar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
