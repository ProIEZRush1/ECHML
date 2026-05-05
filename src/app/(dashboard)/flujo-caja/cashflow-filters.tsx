"use client";

import { useEffect, useState } from "react";
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
import { Filter, X } from "lucide-react";

interface PackOption {
  id: string;
  sku: string;
  name: string;
}

export function CashflowFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [packs, setPacks] = useState<PackOption[]>([]);
  const [packId, setPackId] = useState(searchParams.get("packId") || "");
  const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") || "");
  const [dateTo, setDateTo] = useState(searchParams.get("dateTo") || "");
  const [label, setLabel] = useState(searchParams.get("label") || "");

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
  }, []);

  function applyFilters() {
    const params = new URLSearchParams();
    if (packId && packId !== "all") params.set("packId", packId);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (label && label !== "all") params.set("label", label);

    const query = params.toString();
    router.push(`/flujo-caja${query ? `?${query}` : ""}`);
  }

  function clearFilters() {
    setPackId("");
    setDateFrom("");
    setDateTo("");
    setLabel("");
    router.push("/flujo-caja");
  }

  const hasActiveFilters = (packId && packId !== "all") || dateFrom || dateTo || (label && label !== "all");

  const activeFilters: { key: string; label: string }[] = [];
  if (packId && packId !== "all") {
    const pack = packs.find((p) => p.id === packId);
    activeFilters.push({
      key: "packId",
      label: `Pack: ${pack ? pack.sku : packId.slice(0, 8)}`,
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
    if (key === "packId") setPackId("");
    if (key === "dateFrom") setDateFrom("");
    if (key === "dateTo") setDateTo("");
    if (key === "label") setLabel("");
    const query = params.toString();
    router.push(`/flujo-caja${query ? `?${query}` : ""}`);
  }

  return (
    <Card className="bg-muted/30 border-dashed">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Filtros</span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Pack selector */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Pack</Label>
            <Select value={packId} onValueChange={(v) => setPackId(v ?? "")}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todos los packs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los packs</SelectItem>
                {packs.map((pack) => (
                  <SelectItem key={pack.id} value={pack.id}>
                    {pack.sku} — {pack.name}
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
