"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Filter, Search, X } from "lucide-react";

interface Pack {
  id: string;
  sku: string;
  name: string;
}

interface PublicacionesFiltersProps {
  packs: Pack[];
}

export function PublicacionesFilters({ packs }: PublicacionesFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [packId, setPackId] = useState(searchParams.get("packId") || "");

  function apply() {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (status) p.set("status", status);
    if (packId) p.set("packId", packId);
    const qs = p.toString();
    router.push(`/publicaciones${qs ? `?${qs}` : ""}`);
  }

  function clear() {
    setQ("");
    setStatus("");
    setPackId("");
    router.push("/publicaciones");
  }

  function removeFilter(key: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.delete(key);
    p.delete("page");
    router.push(`/publicaciones?${p.toString()}`);
  }

  const hasFilters = !!(
    searchParams.get("q") ||
    searchParams.get("status") ||
    searchParams.get("packId")
  );

  const statusLabels: Record<string, string> = {
    ACTIVE: "Activa",
    PAUSED: "Pausada",
    CLOSED: "Cerrada",
    UNDER_REVIEW: "En revision",
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
            <label className="text-xs text-muted-foreground mb-1 block">
              Buscar
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Titulo o ML ID..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && apply()}
                className="pl-8 h-9"
              />
            </div>
          </div>

          <div className="w-[140px]">
            <label className="text-xs text-muted-foreground mb-1 block">
              Estado
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
            >
              <option value="">Todos</option>
              <option value="ACTIVE">Activa</option>
              <option value="PAUSED">Pausada</option>
              <option value="CLOSED">Cerrada</option>
              <option value="UNDER_REVIEW">En revision</option>
            </select>
          </div>

          <div className="w-[200px]">
            <label className="text-xs text-muted-foreground mb-1 block">
              Pack
            </label>
            <select
              value={packId}
              onChange={(e) => setPackId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
            >
              <option value="">Todos los packs</option>
              {packs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} - {p.name}
                </option>
              ))}
            </select>
          </div>

          <Button onClick={apply} size="sm" className="h-9">
            Aplicar
          </Button>

          {hasFilters && (
            <Button onClick={clear} variant="ghost" size="sm" className="h-9">
              Limpiar
            </Button>
          )}
        </div>

        {hasFilters && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {searchParams.get("q") && (
              <Badge
                variant="secondary"
                className="gap-1 cursor-pointer"
                onClick={() => removeFilter("q")}
              >
                Busqueda: {searchParams.get("q")}
                <X className="h-3 w-3" />
              </Badge>
            )}
            {searchParams.get("status") && (
              <Badge
                variant="secondary"
                className="gap-1 cursor-pointer"
                onClick={() => removeFilter("status")}
              >
                Estado: {statusLabels[searchParams.get("status")!] || searchParams.get("status")}
                <X className="h-3 w-3" />
              </Badge>
            )}
            {searchParams.get("packId") && (
              <Badge
                variant="secondary"
                className="gap-1 cursor-pointer"
                onClick={() => removeFilter("packId")}
              >
                Pack: {packs.find((p) => p.id === searchParams.get("packId"))?.sku || "..."}
                <X className="h-3 w-3" />
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
