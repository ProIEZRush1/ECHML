"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export function ContabilidadFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [dateFrom, setDateFrom] = useState(() => {
    if (searchParams.get("dateFrom")) return searchParams.get("dateFrom")!;
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => searchParams.get("dateTo") || new Date().toISOString().split("T")[0]);

  function apply() {
    const p = new URLSearchParams();
    if (dateFrom) p.set("dateFrom", dateFrom);
    if (dateTo) p.set("dateTo", dateTo);
    router.push(`/contabilidad?${p.toString()}`);
  }

  function clear() {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    setDateFrom(d.toISOString().split("T")[0]);
    setDateTo(new Date().toISOString().split("T")[0]);
    router.push("/contabilidad");
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <label className="text-[11px] text-muted-foreground font-medium">Desde</label>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-40 h-9 text-[13px]"
        />
      </div>
      <div className="space-y-1">
        <label className="text-[11px] text-muted-foreground font-medium">Hasta</label>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-40 h-9 text-[13px]"
        />
      </div>
      <Button onClick={apply} size="sm" className="h-9">
        Aplicar
      </Button>
      {searchParams.has("dateFrom") && (
        <Button onClick={clear} variant="ghost" size="sm" className="h-9 text-muted-foreground">
          <X className="h-3.5 w-3.5 mr-1" />
          Limpiar
        </Button>
      )}
    </div>
  );
}
