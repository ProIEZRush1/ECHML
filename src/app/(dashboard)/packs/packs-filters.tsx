"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Filter, Search, X } from "lucide-react";

export function PacksFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") || "");
  const [type, setType] = useState(searchParams.get("type") || "");

  function apply() {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (type) p.set("type", type);
    const qs = p.toString();
    router.push(`/packs${qs ? `?${qs}` : ""}`);
  }

  function clear() {
    setQ("");
    setType("");
    router.push("/packs");
  }

  function removeFilter(key: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.delete(key);
    p.delete("page");
    router.push(`/packs?${p.toString()}`);
  }

  const hasFilters = !!(searchParams.get("q") || searchParams.get("type"));

  const typeLabels: Record<string, string> = {
    tms: "Timi's (TM-)",
    ml: "ML Import (ML-)",
    "with-stock": "Con stock",
    "no-stock": "Sin stock",
  };

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filtros</span>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground mb-1 block">Buscar</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Nombre o SKU..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && apply()}
                className="pl-8 h-9"
              />
            </div>
          </div>

          <div className="w-[180px]">
            <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
            >
              <option value="">Todos</option>
              <option value="tms">Timi&apos;s (TM-)</option>
              <option value="ml">ML Import (ML-)</option>
              <option value="with-stock">Con stock</option>
              <option value="no-stock">Sin stock</option>
            </select>
          </div>

          <Button onClick={apply} size="sm" className="h-9">Aplicar</Button>
          {hasFilters && (
            <Button onClick={clear} variant="ghost" size="sm" className="h-9">Limpiar</Button>
          )}
        </div>

        {hasFilters && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {searchParams.get("q") && (
              <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => removeFilter("q")}>
                Busqueda: {searchParams.get("q")}
                <X className="h-3 w-3" />
              </Badge>
            )}
            {searchParams.get("type") && (
              <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => removeFilter("type")}>
                Tipo: {typeLabels[searchParams.get("type")!] || searchParams.get("type")}
                <X className="h-3 w-3" />
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
