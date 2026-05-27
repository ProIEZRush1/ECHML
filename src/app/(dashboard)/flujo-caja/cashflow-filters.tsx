"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Filter, X, Search } from "lucide-react";

interface PackOption {
  id: string;
  sku: string;
  name: string;
}

interface ProductOption {
  id: string;
  name: string;
  brand: string | null;
}

interface ProductGroupOption {
  id: string;
  name: string;
  color: string;
  products: { id: string; name: string; brand: string | null }[];
}

export function CashflowFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [packs, setPacks] = useState<PackOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [groups, setGroups] = useState<ProductGroupOption[]>([]);
  const [activeGroupIds, setActiveGroupIds] = useState<Set<string>>(new Set());
  const [selectedPackIds, setSelectedPackIds] = useState<string[]>(() => {
    const p = searchParams.get("packIds") || searchParams.get("packId") || "";
    return p ? p.split(",").filter(Boolean) : [];
  });
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(() => {
    const p = searchParams.get("productIds") || searchParams.get("productId") || "";
    return p ? p.split(",").filter(Boolean) : [];
  });
  const [dateFrom, setDateFrom] = useState(() => {
    if (searchParams.get("dateFrom")) return searchParams.get("dateFrom")!;
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(searchParams.get("dateTo") || "");
  const [label, setLabel] = useState(searchParams.get("label") || "");
  const [packSearch, setPackSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [showPacks, setShowPacks] = useState(false);
  const [showProducts, setShowProducts] = useState(false);

  useEffect(() => {
    fetch("/api/packs").then(r => r.ok ? r.json() : []).then(data => {
      setPacks((data || []).map((p: Record<string, string>) => ({
        id: p.id, sku: p.sku, name: p.name,
      })));
    });
    fetch("/api/products").then(r => r.ok ? r.json() : []).then(data => {
      setProducts((data || []).map((p: Record<string, string | null>) => ({
        id: p.id, name: p.name, brand: p.brand,
      })));
    });
    fetch("/api/product-groups").then(r => r.ok ? r.json() : []).then(data => {
      const loadedGroups: ProductGroupOption[] = data || [];
      setGroups(loadedGroups);
      // Auto-detect active group from URL productIds
      if (selectedProductIds.length > 0) {
        const urlSet = new Set(selectedProductIds);
        for (const g of loadedGroups) {
          const groupProductIds = new Set(g.products.map(p => p.id));
          if (groupProductIds.size > 0 && [...groupProductIds].every(id => urlSet.has(id)) && [...urlSet].every(id => groupProductIds.has(id))) {
            setActiveGroupIds(new Set([g.id]));
            break;
          }
        }
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function apply() {
    const p = new URLSearchParams();
    if (selectedPackIds.length) p.set("packIds", selectedPackIds.join(","));
    if (selectedProductIds.length) p.set("productIds", selectedProductIds.join(","));
    if (dateFrom) p.set("dateFrom", dateFrom);
    if (dateTo) p.set("dateTo", dateTo);
    if (label) p.set("label", label);
    router.push(`/flujo-caja?${p.toString()}`);
  }

  function clear() {
    setSelectedPackIds([]);
    setSelectedProductIds([]);
    setActiveGroupIds(new Set());
    setDateFrom("");
    setDateTo("");
    setLabel("");
    setPackSearch("");
    setProductSearch("");
    router.push("/flujo-caja");
  }

  function toggleGroup(groupId: string) {
    const next = new Set(activeGroupIds);
    if (next.has(groupId)) {
      next.delete(groupId);
    } else {
      next.add(groupId);
    }
    setActiveGroupIds(next);

    // Collect all product IDs from active groups
    const newProductIds = new Set<string>();
    for (const gid of next) {
      const g = groups.find(gr => gr.id === gid);
      if (g) g.products.forEach(p => newProductIds.add(p.id));
    }
    const ids = Array.from(newProductIds);
    setSelectedProductIds(ids);

    // Auto-apply immediately
    const p = new URLSearchParams();
    if (ids.length) p.set("productIds", ids.join(","));
    if (dateFrom) p.set("dateFrom", dateFrom);
    if (dateTo) p.set("dateTo", dateTo);
    if (label) p.set("label", label);
    router.push(`/flujo-caja?${p.toString()}`);
  }

  function togglePack(id: string) {
    setSelectedPackIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function toggleProduct(id: string) {
    setSelectedProductIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  const filteredPacks = packs.filter(p =>
    !packSearch || p.name.toLowerCase().includes(packSearch.toLowerCase()) ||
    p.sku.toLowerCase().includes(packSearch.toLowerCase())
  );

  const filteredProducts = products.filter(p =>
    !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.brand && p.brand.toLowerCase().includes(productSearch.toLowerCase()))
  );

  const hasFilters = selectedPackIds.length > 0 || selectedProductIds.length > 0 ||
    activeGroupIds.size > 0 || dateFrom || dateTo || label;

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-4 space-y-3 overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filtros</span>
          </div>
          {hasFilters && (
            <Button onClick={clear} variant="ghost" size="sm" className="text-xs h-7">
              Limpiar todo
            </Button>
          )}
        </div>

        {/* Row 1: Date + Type */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Desde</label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Hasta</label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
            <select
              value={label}
              onChange={e => setLabel(e.target.value)}
              className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Todas</option>
              <option value="sale">Ventas</option>
              <option value="fee">Comisiones</option>
              <option value="shipping">Envios</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button onClick={apply} size="sm" className="h-8 w-full">Aplicar</Button>
          </div>
        </div>

        {/* Row 2: Product Groups quick-select */}
        {groups.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground block">Grupos</label>
            <div className="flex flex-wrap gap-1.5">
              {groups.map(g => (
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
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ backgroundColor: g.color }}
                  />
                  {g.name}
                  <span className="text-[10px] opacity-70">({g.products.length})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Row 3: Pack + Product selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Packs multi-select */}
          <div>
            <button
              onClick={() => setShowPacks(!showPacks)}
              className="flex items-center justify-between w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
            >
              <span className="truncate">
                {selectedPackIds.length > 0
                  ? `${selectedPackIds.length} pack${selectedPackIds.length > 1 ? "s" : ""} seleccionado${selectedPackIds.length > 1 ? "s" : ""}`
                  : "Seleccionar packs..."}
              </span>
              <span className="text-xs text-muted-foreground">▼</span>
            </button>
            {showPacks && (
              <div className="mt-1 rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
                <div className="p-2 sticky top-0 bg-popover border-b">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input
                      placeholder="Buscar pack..."
                      value={packSearch}
                      onChange={e => setPackSearch(e.target.value)}
                      className="h-7 pl-7 text-xs"
                    />
                  </div>
                </div>
                {filteredPacks.slice(0, 30).map(p => (
                  <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={selectedPackIds.includes(p.id)}
                      onChange={() => togglePack(p.id)}
                      className="rounded"
                    />
                    <span className="font-mono text-xs text-muted-foreground w-20 truncate">{p.sku}</span>
                    <span className="truncate text-xs">{p.name}</span>
                  </label>
                ))}
                {filteredPacks.length === 0 && (
                  <div className="p-2 text-xs text-muted-foreground text-center">Sin resultados</div>
                )}
              </div>
            )}
          </div>

          {/* Products multi-select */}
          <div>
            <button
              onClick={() => setShowProducts(!showProducts)}
              className="flex items-center justify-between w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
            >
              <span className="truncate">
                {selectedProductIds.length > 0
                  ? `${selectedProductIds.length} producto${selectedProductIds.length > 1 ? "s" : ""} seleccionado${selectedProductIds.length > 1 ? "s" : ""}`
                  : "Seleccionar productos..."}
              </span>
              <span className="text-xs text-muted-foreground">▼</span>
            </button>
            {showProducts && (
              <div className="mt-1 rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
                <div className="p-2 sticky top-0 bg-popover border-b">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input
                      placeholder="Buscar producto..."
                      value={productSearch}
                      onChange={e => setProductSearch(e.target.value)}
                      className="h-7 pl-7 text-xs"
                    />
                  </div>
                </div>
                {filteredProducts.slice(0, 30).map(p => (
                  <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={selectedProductIds.includes(p.id)}
                      onChange={() => toggleProduct(p.id)}
                      className="rounded"
                    />
                    {p.brand && <Badge variant="secondary" className="text-[10px] px-1 py-0">{p.brand}</Badge>}
                    <span className="truncate text-xs">{p.name}</span>
                  </label>
                ))}
                {filteredProducts.length === 0 && (
                  <div className="p-2 text-xs text-muted-foreground text-center">Sin resultados</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Active filter badges */}
        {hasFilters && (
          <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto overflow-x-hidden max-w-full">
            {selectedPackIds.map(id => {
              const pack = packs.find(p => p.id === id);
              return (
                <Badge key={id} variant="secondary" className="gap-1 text-xs cursor-pointer" onClick={() => togglePack(id)}>
                  {pack?.sku || id.slice(-6)}
                  <X className="h-3 w-3" />
                </Badge>
              );
            })}
            {activeGroupIds.size > 0 ? (
              [...activeGroupIds].map(gid => {
                const g = groups.find(gr => gr.id === gid);
                return g ? (
                  <Badge key={gid} variant="outline" className="gap-1 text-xs cursor-pointer font-semibold" onClick={() => toggleGroup(gid)} style={{ borderColor: g.color, color: g.color }}>
                    {g.name} ({g.products.length})
                    <X className="h-3 w-3" />
                  </Badge>
                ) : null;
              })
            ) : (
              selectedProductIds.map(id => {
                const prod = products.find(p => p.id === id);
                return (
                  <Badge key={id} variant="outline" className="gap-1 text-xs cursor-pointer" onClick={() => toggleProduct(id)}>
                    {prod?.name?.slice(0, 20) || id.slice(-6)}
                    <X className="h-3 w-3" />
                  </Badge>
                );
              })
            )}
            {dateFrom && (
              <Badge variant="secondary" className="gap-1 text-xs cursor-pointer" onClick={() => setDateFrom("")}>
                Desde: {dateFrom} <X className="h-3 w-3" />
              </Badge>
            )}
            {dateTo && (
              <Badge variant="secondary" className="gap-1 text-xs cursor-pointer" onClick={() => setDateTo("")}>
                Hasta: {dateTo} <X className="h-3 w-3" />
              </Badge>
            )}
            {label && (
              <Badge variant="secondary" className="gap-1 text-xs cursor-pointer" onClick={() => setLabel("")}>
                {label === "sale" ? "Ventas" : label === "fee" ? "Comisiones" : "Envios"}
                <X className="h-3 w-3" />
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
