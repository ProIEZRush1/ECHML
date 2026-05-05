"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, X, Check, ChevronDown } from "lucide-react";

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

export function CashflowFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [packs, setPacks] = useState<PackOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedPackIds, setSelectedPackIds] = useState<string[]>(() => {
    const param = searchParams.get("packIds") || searchParams.get("packId") || "";
    return param ? param.split(",").filter(Boolean) : [];
  });
  const [selectedProductId, setSelectedProductId] = useState(
    searchParams.get("productId") || ""
  );
  const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") || "");
  const [dateTo, setDateTo] = useState(searchParams.get("dateTo") || "");
  const [label, setLabel] = useState(searchParams.get("label") || "");
  const [packDropdownOpen, setPackDropdownOpen] = useState(false);
  const [packSearch, setPackSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/packs")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setPacks(
            data.map((p: { id: string; sku: string; name: string }) => ({
              id: p.id,
              sku: p.sku,
              name: p.name,
            }))
          );
        }
      })
      .catch(() => {});

    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setProducts(
            data.map((p: { id: string; name: string; brand?: string | null }) => ({
              id: p.id,
              name: p.name,
              brand: p.brand || null,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setPackDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function togglePack(packId: string) {
    setSelectedPackIds((prev) =>
      prev.includes(packId)
        ? prev.filter((id) => id !== packId)
        : [...prev, packId]
    );
  }

  function applyFilters() {
    const params = new URLSearchParams();
    if (selectedPackIds.length > 0) params.set("packIds", selectedPackIds.join(","));
    if (selectedProductId) params.set("productId", selectedProductId);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (label && label !== "all") params.set("label", label);

    const query = params.toString();
    router.push(`/flujo-caja${query ? `?${query}` : ""}`);
  }

  function clearFilters() {
    setSelectedPackIds([]);
    setSelectedProductId("");
    setDateFrom("");
    setDateTo("");
    setLabel("");
    router.push("/flujo-caja");
  }

  const hasActiveFilters =
    selectedPackIds.length > 0 ||
    selectedProductId ||
    dateFrom ||
    dateTo ||
    (label && label !== "all");

  const activeFilters: { key: string; label: string }[] = [];
  if (selectedPackIds.length > 0) {
    if (selectedPackIds.length === 1) {
      const pack = packs.find((p) => p.id === selectedPackIds[0]);
      activeFilters.push({
        key: "packIds",
        label: `Pack: ${pack ? pack.sku : selectedPackIds[0].slice(0, 8)}`,
      });
    } else {
      activeFilters.push({
        key: "packIds",
        label: `Packs: ${selectedPackIds.length} seleccionados`,
      });
    }
  }
  if (selectedProductId) {
    const product = products.find((p) => p.id === selectedProductId);
    activeFilters.push({
      key: "productId",
      label: `Producto: ${product ? product.name : selectedProductId.slice(0, 8)}`,
    });
  }
  if (dateFrom) activeFilters.push({ key: "dateFrom", label: `Desde: ${dateFrom}` });
  if (dateTo) activeFilters.push({ key: "dateTo", label: `Hasta: ${dateTo}` });
  if (label && label !== "all") {
    const labelMap: Record<string, string> = {
      sale: "Ventas",
      fee: "Comisiones",
      shipping: "Envios",
    };
    activeFilters.push({ key: "label", label: `Tipo: ${labelMap[label] || label}` });
  }

  function removeFilter(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(key);
    // Also remove legacy single packId param
    params.delete("packId");
    if (key === "packIds") setSelectedPackIds([]);
    if (key === "productId") setSelectedProductId("");
    if (key === "dateFrom") setDateFrom("");
    if (key === "dateTo") setDateTo("");
    if (key === "label") setLabel("");
    const query = params.toString();
    router.push(`/flujo-caja${query ? `?${query}` : ""}`);
  }

  const filteredPacks = packSearch
    ? packs.filter(
        (p) =>
          p.name.toLowerCase().includes(packSearch.toLowerCase()) ||
          p.sku.toLowerCase().includes(packSearch.toLowerCase())
      )
    : packs;

  return (
    <Card className="bg-muted/30 border-dashed">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Filtros</span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {/* Multi-Pack selector */}
          <div className="space-y-1 relative" ref={dropdownRef}>
            <Label className="text-xs text-muted-foreground">Packs</Label>
            <button
              type="button"
              onClick={() => setPackDropdownOpen(!packDropdownOpen)}
              className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <span className="truncate text-left">
                {selectedPackIds.length === 0
                  ? "Todos los packs"
                  : `${selectedPackIds.length} pack${selectedPackIds.length > 1 ? "s" : ""}`}
              </span>
              <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
            </button>

            {packDropdownOpen && (
              <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
                <div className="p-2 border-b">
                  <Input
                    placeholder="Buscar pack..."
                    value={packSearch}
                    onChange={(e) => setPackSearch(e.target.value)}
                    className="h-8 text-xs"
                    autoFocus
                  />
                </div>
                <div className="max-h-48 overflow-y-auto p-1">
                  {filteredPacks.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Sin resultados
                    </p>
                  ) : (
                    filteredPacks.map((pack) => {
                      const isSelected = selectedPackIds.includes(pack.id);
                      return (
                        <button
                          key={pack.id}
                          type="button"
                          onClick={() => togglePack(pack.id)}
                          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer"
                        >
                          <div
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${
                              isSelected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-muted-foreground/30"
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3" />}
                          </div>
                          <span className="truncate">
                            {pack.sku} — {pack.name}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
                {selectedPackIds.length > 0 && (
                  <div className="border-t p-2">
                    <button
                      type="button"
                      onClick={() => setSelectedPackIds([])}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Limpiar seleccion
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Product selector */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Producto</Label>
            <Select
              value={selectedProductId || "all"}
              onValueChange={(v) => setSelectedProductId(v === "all" ? "" : (v ?? ""))}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los productos</SelectItem>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                    {product.brand ? ` (${product.brand})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date from */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Desde</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9"
            />
          </div>

          {/* Date to */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Hasta</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9"
            />
          </div>

          {/* Type selector */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tipo</Label>
            <Select value={label} onValueChange={(v) => setLabel(v ?? "")}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="sale">Ventas</SelectItem>
                <SelectItem value="fee">Comisiones</SelectItem>
                <SelectItem value="shipping">Envios</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex items-end gap-2">
            <Button onClick={applyFilters} size="sm" className="h-9">
              Aplicar
            </Button>
            {hasActiveFilters && (
              <Button
                onClick={clearFilters}
                variant="ghost"
                size="sm"
                className="h-9 text-muted-foreground"
              >
                Limpiar
              </Button>
            )}
          </div>
        </div>

        {/* Active filter badges */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-dashed">
            {activeFilters.map((filter) => (
              <Badge
                key={filter.key}
                variant="secondary"
                className="gap-1 pr-1 text-xs"
              >
                {filter.label}
                <button
                  onClick={() => removeFilter(filter.key)}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
