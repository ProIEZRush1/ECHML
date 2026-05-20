"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

function fmt(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

interface GroupData {
  groupId: string;
  groupName: string;
  groupColor: string;
  utilidad: number;
  retiros: number;
}

interface Props {
  dateFrom: string;
  dateTo: string;
  productToGroupMap: Record<string, string>;
  groups: GroupData[];
}

export function ContabilidadAds({ dateFrom, dateTo, productToGroupMap, groups }: Props) {
  const [adsByGroup, setAdsByGroup] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    fetch(`/api/ads-costs?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) { setAdsByGroup({}); return; }
        const result: Record<string, number> = {};
        for (const p of data.byProduct || []) {
          const gId = productToGroupMap[p.productId] || "__none__";
          result[gId] = (result[gId] || 0) + (p.cost || 0);
        }
        setAdsByGroup(result);
      })
      .catch(() => setAdsByGroup({}));
  }, [dateFrom, dateTo, productToGroupMap]);

  if (adsByGroup === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando publicidad...
      </div>
    );
  }

  const totalAds = Object.values(adsByGroup).reduce((s, v) => s + v, 0);
  if (totalAds === 0) return null;

  return (
    <div className="rounded-[9px] border border-border bg-card p-4">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3">Publicidad por Grupo</p>
      <div className="space-y-1.5">
        {groups.map((g) => {
          const ads = adsByGroup[g.groupId] || 0;
          if (ads === 0) return null;
          return (
            <div key={g.groupId} className="flex items-center justify-between text-[11.5px]">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: g.groupColor }} />
                <span className="font-medium">{g.groupName}</span>
              </div>
              <span className="num margin-bad">-{fmt(ads)}</span>
            </div>
          );
        })}
        <div className="flex items-center justify-between text-[12px] font-semibold pt-1.5 border-t border-border">
          <span>Total Publicidad</span>
          <span className="num margin-bad">-{fmt(totalAds)}</span>
        </div>
      </div>
    </div>
  );
}
