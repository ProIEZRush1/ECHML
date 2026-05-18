"use client";

import { useState, useMemo, useRef } from "react";
import Image from "next/image";
import { PackageCheck, Printer, Filter } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PrepActions } from "./prep-actions";
import type { PrepStatus } from "@prisma/client";

interface PackItem {
  quantity: number;
  productVariant: {
    variantLabel: string | null;
    color: string | null;
    stock: number;
    product: { name: string; id: string };
  };
}

interface Listing {
  mlItemId: string;
  title: string | null;
  pack: {
    id: string;
    sku: string;
    name: string;
    imageUrl: string | null;
    stock: number;
    items: PackItem[];
  };
}

interface Order {
  id: string;
  mlItemId: string;
  mlOrderId: string;
  quantity: number;
  buyerNickname: string | null;
  prepStatus: PrepStatus;
  listing: Listing | null;
  stockAlert: boolean;
}

interface Group {
  id: string;
  name: string;
  color: string;
  productIds: string[];
}

interface KpiData {
  totalNew: number;
  totalPreparing: number;
  totalReady: number;
  todayShipped: number;
}

interface Props {
  orders: Order[];
  groups: Group[];
  kpis: KpiData;
}

export function PrepararContent({ orders, groups, kpis }: Props) {
  const [activeGroup, setActiveGroup] = useState<string>("");
  const printRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!activeGroup) return orders;
    const group = groups.find((g) => g.id === activeGroup);
    if (!group) return orders;
    return orders.filter((o) => {
      const items = o.listing?.pack?.items;
      if (!items) return false;
      return items.some((item) => group.productIds.includes(item.productVariant.product.id));
    });
  }, [orders, groups, activeGroup]);

  const sections: { title: string; status: PrepStatus; orders: Order[]; color: string }[] = [
    { title: "Nuevos", status: "NEW", orders: filtered.filter((o) => o.prepStatus === "NEW"), color: "oklch(0.58 0.16 22)" },
    { title: "Preparando", status: "PREPARING", orders: filtered.filter((o) => o.prepStatus === "PREPARING"), color: "oklch(0.60 0.14 78)" },
    { title: "Listos para Enviar", status: "READY", orders: filtered.filter((o) => o.prepStatus === "READY"), color: "oklch(0.55 0.12 200)" },
  ];

  function printLabels(ordersToPrint: Order[]) {
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) return;
    const labels = ordersToPrint.map((o) => {
      const pack = o.listing?.pack;
      const items = pack?.items?.map((i) => `${i.quantity * o.quantity}× ${i.productVariant.variantLabel || i.productVariant.product.name}`).join(", ") || "";
      return `<div style="border:2px solid #000;padding:12px;margin:8px 0;page-break-inside:avoid;font-family:system-ui">
        <div style="font-size:18px;font-weight:700">${pack?.name || o.mlItemId}</div>
        <div style="font-size:13px;color:#555;margin:4px 0">${pack?.sku || ""} · ×${o.quantity}</div>
        <div style="font-size:14px;margin-top:6px;border-top:1px solid #ddd;padding-top:6px">${items}</div>
        <div style="font-size:11px;color:#888;margin-top:4px">${o.buyerNickname || ""} · #${String(o.mlOrderId).slice(-8)}</div>
      </div>`;
    }).join("");
    w.document.write(`<html><head><title>Etiquetas</title></head><body style="margin:16px">${labels}<script>window.print()</script></body></html>`);
    w.document.close();
  }

  return (
    <>
      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Nuevos", value: kpis.totalNew, cls: "margin-bad" },
          { label: "Preparando", value: kpis.totalPreparing, cls: "margin-warn" },
          { label: "Listos", value: kpis.totalReady, style: { color: "oklch(0.55 0.12 200)" } as React.CSSProperties },
          { label: "Enviados Hoy", value: kpis.todayShipped, cls: "margin-good" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-[9px] border border-border bg-card px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{kpi.label}</p>
            <p className={`text-xl font-bold mt-0.5 num ${kpi.cls || ""}`} style={kpi.style}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Filters + Print */}
      <div className="filt-bar">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="lbl">Grupo</span>
        <div className="pillgroup">
          <button className={activeGroup === "" ? "on" : ""} onClick={() => setActiveGroup("")}>
            Todos
          </button>
          {groups.map((g) => (
            <button
              key={g.id}
              className={activeGroup === g.id ? "on" : ""}
              onClick={() => setActiveGroup(g.id)}
            >
              <span className="inline-block h-2 w-2 rounded-full mr-1" style={{ background: g.color }} />
              {g.name}
            </button>
          ))}
        </div>
        <button
          onClick={() => printLabels(filtered)}
          className="ml-auto filt-input hover:border-muted-foreground"
          disabled={filtered.length === 0}
        >
          <Printer className="h-3 w-3" />
          Imprimir Todas ({filtered.length})
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={PackageCheck}
          title="Todo al dia"
          description="No hay ordenes pendientes de preparar."
        />
      ) : (
        <div ref={printRef}>
          {sections.map((section) => {
            if (section.orders.length === 0) return null;
            return (
              <div key={section.status} className="space-y-3 mb-6">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: section.color }} />
                  <h2 className="text-[14px] font-semibold">{section.title} ({section.orders.length})</h2>
                  <button
                    onClick={() => printLabels(section.orders)}
                    className="ml-auto text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  >
                    <Printer className="h-3 w-3" />
                    Imprimir
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {section.orders.map((order) => {
                    const listing = order.listing;
                    const pack = listing?.pack;
                    return (
                      <div
                        key={order.id}
                        className={`rounded-[9px] border bg-card px-3 py-2.5 space-y-2 ${
                          order.stockAlert ? "border-red-400 dark:border-red-800" : "border-border"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {pack?.imageUrl && (
                            <div className="shrink-0 h-10 w-10 rounded-md overflow-hidden border bg-muted">
                              <Image src={pack.imageUrl} alt={pack.name} width={40} height={40} className="h-full w-full object-cover" unoptimized />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-[12px] truncate">{pack?.name || order.mlItemId}</p>
                            <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground mt-0.5">
                              {pack?.sku && <span className="mono">{pack.sku}</span>}
                              <span className="text-border">·</span>
                              <span className="font-semibold text-foreground">×{order.quantity}</span>
                              {order.buyerNickname && (
                                <>
                                  <span className="text-border">·</span>
                                  <span className="truncate">{order.buyerNickname}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {order.stockAlert && (
                              <span className="text-[9px] font-semibold text-red-500 uppercase">Sin stock</span>
                            )}
                            <button
                              onClick={() => printLabels([order])}
                              className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
                              title="Imprimir etiqueta"
                            >
                              <Printer className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        {pack?.items && pack.items.length > 0 && (
                          <div className="border-t border-border pt-1.5 space-y-0.5">
                            {pack.items.map((item, idx) => {
                              const totalNeeded = item.quantity * order.quantity;
                              const label = item.productVariant.variantLabel || item.productVariant.product.name;
                              const lowStock = item.productVariant.stock < totalNeeded;
                              return (
                                <div key={idx} className="flex items-center justify-between text-[11px]">
                                  <span className={lowStock ? "text-red-500" : "text-muted-foreground"}>
                                    {totalNeeded}× {label}
                                  </span>
                                  <span className={`mono text-[10px] ${lowStock ? "text-red-500 font-semibold" : "text-muted-foreground"}`}>
                                    ({item.productVariant.stock} disp.)
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <PrepActions orderId={order.id} currentStatus={order.prepStatus} />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
