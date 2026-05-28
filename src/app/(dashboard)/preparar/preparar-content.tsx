"use client";

import { useState, useMemo, useRef, useEffect } from "react";
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

interface SubOrder {
  listing: Listing | null;
  quantity: number;
  mlItemId: string;
}

interface Order {
  id: string;
  mlItemId: string;
  mlOrderId: string;
  mlPackId: string | null;
  shipmentId: string | null;
  quantity: number;
  buyerNickname: string | null;
  prepStatus: PrepStatus;
  shippingStatus: string;
  logisticType: string | null;
  listing: Listing | null;
  stockAlert: boolean;
  subOrders: SubOrder[] | null;
  orderIds: string[];
  shippingDeadline: string | null;
  dateCreated: string;
}

interface Group {
  id: string;
  name: string;
  color: string;
  productIds: string[];
}

interface CancelledOrder {
  id: string;
  mlItemId: string;
  mlOrderId: string;
  mlPackId: string | null;
  shipmentId: string | null;
  quantity: number;
  buyerNickname: string | null;
  listing: Listing | null;
  logisticType: string | null;
  dateCreated: string;
}

interface KpiData {
  totalNew: number;
  totalPending: number;
  totalPreparing: number;
  totalReady: number;
  todayShipped: number;
  totalCancelled: number;
}

interface Props {
  orders: Order[];
  cancelledOrders: CancelledOrder[];
  groups: Group[];
  kpis: KpiData;
}

const STATUS_TABS: { label: string; value: string }[] = [
  { label: "Todos", value: "" },
  { label: "Nuevos", value: "NEW" },
  { label: "Etiqueta impresa", value: "PREPARING" },
  { label: "Listos", value: "READY" },
];

const SORT_OPTIONS = [
  { label: "Mas antiguos", value: "oldest" },
  { label: "Mas recientes", value: "newest" },
  { label: "Mas urgentes", value: "urgent" },
  { label: "Por tipo", value: "type" },
];

const URGENCY_TABS = [
  { label: "Todos", value: "" },
  { label: "Vencido", value: "overdue" },
  { label: "Hoy", value: "today" },
  { label: "Manana", value: "tomorrow" },
];

function getDeadlineUrgency(deadline: string | null): { label: string; cls: string; value: string } {
  if (!deadline) return { label: "", cls: "", value: "" };
  const now = new Date();
  const dl = new Date(deadline);
  const diffMs = dl.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours < 0) return { label: "Vencido", cls: "text-red-600 bg-red-100 dark:bg-red-950/30 dark:text-red-400", value: "overdue" };
  if (diffHours < 6) return { label: "Urgente", cls: "text-amber-700 bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400", value: "today" };
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  if (dl <= todayEnd) return { label: "Hoy", cls: "text-amber-600 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400", value: "today" };
  const tomorrowEnd = new Date(todayEnd); tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
  if (dl <= tomorrowEnd) return { label: "Manana", cls: "text-blue-600 bg-blue-50 dark:bg-blue-950/20 dark:text-blue-400", value: "tomorrow" };
  return { label: formatDeadlineShort(dl), cls: "text-muted-foreground bg-muted", value: "later" };
}

function formatDeadlineShort(d: Date): string {
  const day = d.getDate();
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${day} ${months[d.getMonth()]}`;
}

function formatDeadlineFull(deadline: string): string {
  const d = new Date(deadline);
  const now = new Date();
  const day = d.getDate();
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const isToday = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  if (isToday) {
    const hours = d.getHours();
    const mins = d.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "p.m." : "a.m.";
    const h = hours % 12 || 12;
    return `Hoy, ${h}:${mins} ${ampm}`;
  }
  return `${day} ${months[d.getMonth()]}`;
}

const INTERNAL_VARIANT_PATTERN = /^(BIB-4PK|KIT-|BIB-4PK-)/;

function isInternalVariant(label: string | null): boolean {
  if (!label) return false;
  return INTERNAL_VARIANT_PATTERN.test(label);
}

function itemLabel(item: PackItem): string {
  const prodName = item.productVariant.product.name;
  const variant = item.productVariant.variantLabel;
  if (!variant || variant === "Default" || variant === prodName) return prodName;
  return `${prodName} (${variant})`;
}

export function PrepararContent({ orders, cancelledOrders, groups, kpis }: Props) {
  const [activeGroups, setActiveGroups] = useState<string[]>([]);
  const [activeStatuses, setActiveStatuses] = useState<string[]>([]);
  const [activeVariants, setActiveVariants] = useState<string[]>([]);
  const [activeUrgency, setActiveUrgency] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<string>("oldest");
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const printRef = useRef<HTMLDivElement>(null);
  const hasSynced = useRef(false);

  function getAllItems(o: Order): { items: PackItem[]; qty: number }[] {
    if (o.subOrders) {
      return o.subOrders.map((so) => ({ items: so.listing?.pack?.items || [], qty: so.quantity }));
    }
    return [{ items: o.listing?.pack?.items || [], qty: o.quantity }];
  }

  const groupFilteredOrders = useMemo(() => {
    if (activeGroups.length === 0) return orders;
    const selectedGroups = groups.filter((g) => activeGroups.includes(g.id));
    const allProductIds = new Set(selectedGroups.flatMap((g) => g.productIds));
    return orders.filter((o) => {
      for (const { items } of getAllItems(o)) {
        if (items.some((item) => allProductIds.has(item.productVariant.product.id))) return true;
      }
      return false;
    });
  }, [orders, groups, activeGroups]);

  const allVariants = useMemo(() => {
    const set = new Set<string>();
    for (const o of groupFilteredOrders) {
      for (const { items } of getAllItems(o)) {
        for (const item of items) {
          set.add(itemLabel(item));
        }
      }
    }
    return [...set].sort();
  }, [groupFilteredOrders]);

  useEffect(() => {
    if (hasSynced.current) return;
    hasSynced.current = true;
    fetch("/api/orders/sync-status", { method: "POST" }).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    let result = orders;
    if (activeGroups.length > 0) {
      const selectedGroups = groups.filter((g) => activeGroups.includes(g.id));
      const allProductIds = new Set(selectedGroups.flatMap((g) => g.productIds));
      result = result.filter((o) => {
        for (const { items } of getAllItems(o)) {
          if (items.some((item) => allProductIds.has(item.productVariant.product.id))) return true;
        }
        return false;
      });
    }
    if (activeStatuses.length > 0) {
      result = result.filter((o) => activeStatuses.includes(o.prepStatus));
    }
    if (activeVariants.length > 0) {
      result = result.filter((o) => {
        for (const { items } of getAllItems(o)) {
          if (items.some((item) => activeVariants.includes(itemLabel(item)))) return true;
        }
        return false;
      });
    }
    if (activeUrgency) {
      result = result.filter((o) => {
        const u = getDeadlineUrgency(o.shippingDeadline);
        return u.value === activeUrgency;
      });
    }
    if (sortOrder === "newest") {
      result = [...result].reverse();
    } else if (sortOrder === "urgent") {
      result = [...result].sort((a, b) => {
        const da = a.shippingDeadline ? new Date(a.shippingDeadline).getTime() : Infinity;
        const db = b.shippingDeadline ? new Date(b.shippingDeadline).getTime() : Infinity;
        return da - db;
      });
    } else if (sortOrder === "type") {
      result = [...result].sort((a, b) => {
        const keyFor = (o: Order) => {
          const allItems = getAllItems(o);
          return allItems.map(({ items, qty }) =>
            items.map((i) => `${qty}x${itemLabel(i)}`).sort().join("+")
          ).sort().join("|");
        };
        return keyFor(a).localeCompare(keyFor(b));
      });
    }
    return result;
  }, [orders, groups, activeGroups, activeStatuses, activeVariants, activeUrgency, sortOrder]);

  const newReady = filtered.filter((o) => o.prepStatus === "NEW" && o.shippingStatus !== "PENDING");
  const newPending = filtered.filter((o) => o.prepStatus === "NEW" && o.shippingStatus === "PENDING");

  const sections: { title: string; status: PrepStatus; orders: Order[]; color: string }[] = [
    { title: "Nuevos", status: "NEW", orders: newReady, color: "oklch(0.58 0.16 22)" },
    { title: "Etiqueta impresa", status: "PREPARING", orders: filtered.filter((o) => o.prepStatus === "PREPARING"), color: "oklch(0.60 0.14 78)" },
    { title: "Listos para Enviar", status: "READY", orders: filtered.filter((o) => o.prepStatus === "READY"), color: "oklch(0.55 0.12 200)" },
    ...(newPending.length > 0 ? [{ title: "Esperando etiqueta", status: "NEW" as PrepStatus, orders: newPending, color: "oklch(0.50 0.05 250)" }] : []),
  ];

  function computeVariantTotals(orderList: Order[]) {
    const map = new Map<string, { label: string; total: number; stock: number }>();
    for (const order of orderList) {
      for (const { items, qty } of getAllItems(order)) {
        for (const item of items) {
          if (isInternalVariant(item.productVariant.variantLabel)) continue;
          const label = itemLabel(item);
          const existing = map.get(label);
          const needed = item.quantity * qty;
          if (existing) {
            existing.total += needed;
          } else {
            map.set(label, { label, total: needed, stock: item.productVariant.stock });
          }
        }
      }
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }

  const newOrders = useMemo(() => filtered.filter((o) => o.prepStatus === "NEW" && o.shippingStatus !== "PENDING"), [filtered]);
  const preparedOrders = useMemo(() => filtered.filter((o) => o.prepStatus !== "NEW"), [filtered]);
  const newTotals = useMemo(() => computeVariantTotals(newOrders), [newOrders]);
  const preparedTotals = useMemo(() => computeVariantTotals(preparedOrders), [preparedOrders]);

  async function printLabel(shipmentId: string) {
    const res = await fetch(`/api/ml/shipping-label?shipmentId=${shipmentId}`);
    if (!res.ok) { alert("No se pudo obtener la etiqueta"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }

  async function printLabels(ordersToPrint: Order[], layout?: "single") {
    const withShipment = ordersToPrint.filter((o) => o.shipmentId);
    if (withShipment.length === 0) { alert("Ninguna orden tiene envio asignado"); return; }
    const ids = withShipment.map((o) => o.shipmentId).join(",");
    const layoutParam = layout ? `&layout=${layout}` : "";
    const res = await fetch(`/api/ml/shipping-label?shipmentIds=${ids}${layoutParam}`);
    if (!res.ok) { alert("Error al obtener etiquetas"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }

  return (
    <>
      {/* KPI cards */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: "Nuevos", value: kpis.totalNew, cls: "margin-bad" },
          { label: "Esperando etiqueta", value: kpis.totalPending, cls: "text-muted-foreground" },
          { label: "Etiqueta impresa", value: kpis.totalPreparing, cls: "margin-warn" },
          { label: "Listos", value: kpis.totalReady, style: { color: "oklch(0.55 0.12 200)" } as React.CSSProperties },
          { label: "Enviados Hoy", value: kpis.todayShipped, cls: "margin-good" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-border bg-card glass px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{kpi.label}</p>
            <p className={`text-xl font-bold mt-0.5 num ${kpi.cls || ""}`} style={kpi.style}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="filt-bar flex-wrap">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="lbl">Estado</span>
        <div className="pillgroup">
          <button className={activeStatuses.length === 0 ? "on" : ""} onClick={() => setActiveStatuses([])}>
            Todos
          </button>
          {STATUS_TABS.filter((t) => t.value).map((tab) => {
            const isOn = activeStatuses.includes(tab.value);
            return (
              <button
                key={tab.value}
                className={isOn ? "on" : ""}
                onClick={() => setActiveStatuses((prev) =>
                  prev.includes(tab.value) ? prev.filter((x) => x !== tab.value) : [...prev, tab.value]
                )}
              >
                {tab.label}
                {isOn && activeStatuses.length > 1 && <span className="ml-0.5 opacity-50">×</span>}
              </button>
            );
          })}
        </div>
        <span className="lbl">Grupo</span>
        <div className="pillgroup">
          <button className={activeGroups.length === 0 ? "on" : ""} onClick={() => setActiveGroups([])}>
            Todos
          </button>
          {groups.map((g) => {
            const isOn = activeGroups.includes(g.id);
            return (
              <button
                key={g.id}
                className={isOn ? "on" : ""}
                onClick={() => setActiveGroups((prev) =>
                  prev.includes(g.id) ? prev.filter((x) => x !== g.id) : [...prev, g.id]
                )}
              >
                <span className="inline-block h-2 w-2 rounded-full mr-1" style={{ background: g.color }} />
                {g.name}
                {isOn && activeGroups.length > 1 && <span className="ml-0.5 opacity-50">×</span>}
              </button>
            );
          })}
        </div>
        {allVariants.length > 1 && (
          <>
            <span className="lbl">Variante</span>
            <div className="pillgroup">
              <button className={activeVariants.length === 0 ? "on" : ""} onClick={() => setActiveVariants([])}>
                Todas
              </button>
              {allVariants.map((v) => {
                const isOn = activeVariants.includes(v);
                return (
                  <button
                    key={v}
                    className={isOn ? "on" : ""}
                    onClick={() => setActiveVariants((prev) =>
                      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]
                    )}
                  >
                    {v}
                    {isOn && activeVariants.length > 1 && <span className="ml-0.5 opacity-50">×</span>}
                  </button>
                );
              })}
            </div>
          </>
        )}
        <span className="lbl">Envio</span>
        <div className="pillgroup">
          {URGENCY_TABS.map((tab) => (
            <button key={tab.value} className={activeUrgency === tab.value ? "on" : ""} onClick={() => setActiveUrgency(tab.value)}>
              {tab.label}
            </button>
          ))}
        </div>
        <span className="lbl">Orden</span>
        <div className="pillgroup">
          {SORT_OPTIONS.map((opt) => (
            <button key={opt.value} className={sortOrder === opt.value ? "on" : ""} onClick={() => setSortOrder(opt.value)}>
              {opt.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {selectedOrders.size > 0 && (
            <>
              <button
                onClick={() => printLabels(filtered.filter((o) => selectedOrders.has(o.id)))}
                className="filt-input border-blue-400 text-blue-700 dark:text-blue-400 hover:border-blue-500"
              >
                <Printer className="h-3 w-3" />
                Seleccion 3x ({filtered.filter((o) => selectedOrders.has(o.id) && o.shipmentId).length})
              </button>
              <button
                onClick={() => printLabels(filtered.filter((o) => selectedOrders.has(o.id)), "single")}
                className="filt-input border-blue-400 text-blue-700 dark:text-blue-400 hover:border-blue-500"
              >
                <Printer className="h-3 w-3" />
                Seleccion 1x
              </button>
              <button
                onClick={() => setSelectedOrders(new Set())}
                className="filt-input hover:border-muted-foreground text-[10px]"
              >
                Deseleccionar ({selectedOrders.size})
              </button>
            </>
          )}
          <button
            onClick={() => printLabels(filtered)}
            className="filt-input hover:border-muted-foreground"
            disabled={filtered.length === 0}
          >
            <Printer className="h-3 w-3" />
            Todas 3x ({filtered.filter((o) => o.shipmentId).length})
          </button>
          <button
            onClick={() => printLabels(filtered, "single")}
            className="filt-input hover:border-muted-foreground"
            disabled={filtered.length === 0}
          >
            <Printer className="h-3 w-3" />
            Todas 1x
          </button>
        </div>
      </div>

      {/* Totals by variant - split by status */}
      {filtered.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {newTotals.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "oklch(0.58 0.16 22)" }}>
                  Nuevos por preparar ({newOrders.length})
                </p>
                {checkedItems.size > 0 && (
                  <button onClick={() => setCheckedItems(new Set())} className="text-[10px] text-muted-foreground hover:text-foreground">
                    Limpiar
                  </button>
                )}
              </div>
              <div className="space-y-0.5">
                {newTotals.map((v) => {
                  const key = `new-${v.label}`;
                  const checked = checkedItems.has(key);
                  return (
                    <label key={v.label} className={`flex items-center gap-2 text-[12px] mono cursor-pointer py-0.5 rounded hover:bg-muted/50 px-1 -mx-1 ${checked ? "line-through opacity-40" : ""}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setCheckedItems((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; })}
                        className="rounded border-input h-3.5 w-3.5 shrink-0"
                      />
                      {v.total}× {v.label}
                      <span className="text-[10px] text-muted-foreground">({v.stock} en stock)</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          {preparedTotals.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-[10px] uppercase tracking-wider font-medium mb-2" style={{ color: "oklch(0.55 0.12 200)" }}>
                Etiqueta impresa / Listos ({preparedOrders.length})
              </p>
              <div className="space-y-0.5">
                {preparedTotals.map((v) => {
                  const key = `prep-${v.label}`;
                  const checked = checkedItems.has(key);
                  return (
                    <label key={v.label} className={`flex items-center gap-2 text-[12px] mono cursor-pointer py-0.5 rounded hover:bg-muted/50 px-1 -mx-1 ${checked ? "line-through opacity-40" : ""}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setCheckedItems((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; })}
                        className="rounded border-input h-3.5 w-3.5 shrink-0"
                      />
                      {v.total}× {v.label}
                      <span className="text-[10px] text-muted-foreground">({v.stock} en stock)</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

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
                  <div className="ml-auto flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        const ids = section.orders.map((o) => o.id);
                        const allSelected = ids.every((id) => selectedOrders.has(id));
                        setSelectedOrders((prev) => {
                          const n = new Set(prev);
                          if (allSelected) ids.forEach((id) => n.delete(id));
                          else ids.forEach((id) => n.add(id));
                          return n;
                        });
                      }}
                      className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                    >
                      {section.orders.every((o) => selectedOrders.has(o.id)) ? "Deseleccionar" : "Seleccionar"} todos
                    </button>
                    <span className="text-border">|</span>
                    <button
                      onClick={() => printLabels(section.orders)}
                      className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                    >
                      <Printer className="h-3 w-3" />
                      3x ({section.orders.filter((o) => o.shipmentId).length})
                    </button>
                    <button
                      onClick={() => printLabels(section.orders, "single")}
                      className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                    >
                      1x
                    </button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-start">
                  {section.orders.map((order) => {
                    const listing = order.listing;
                    const pack = listing?.pack;
                    const isMulti = !!order.subOrders;
                    const allItemGroups = getAllItems(order);
                    const urgency = getDeadlineUrgency(order.shippingDeadline);
                    const isOverdue = urgency.value === "overdue";
                    return (
                      <div
                        key={order.id}
                        className={`rounded-xl border bg-card glass px-3.5 py-3 flex flex-col gap-2 min-h-[180px] transition-all duration-200 hover:shadow-md ${
                          isOverdue ? "border-red-400 dark:border-red-800" : isMulti ? "border-blue-400/50 dark:border-blue-700/50" : "border-border hover:border-accent/20"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={selectedOrders.has(order.id)}
                            onChange={() => setSelectedOrders((prev) => {
                              const n = new Set(prev);
                              n.has(order.id) ? n.delete(order.id) : n.add(order.id);
                              return n;
                            })}
                            className="rounded border-input h-3.5 w-3.5 shrink-0 cursor-pointer accent-blue-600"
                          />
                          {pack?.imageUrl && (
                            <div className="shrink-0 h-10 w-10 rounded-md overflow-hidden border bg-muted">
                              <Image src={pack.imageUrl} alt={pack.name} width={40} height={40} className="h-full w-full object-cover" unoptimized />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-[12px] truncate">
                              {isMulti ? `Paquete de ${order.subOrders!.length} productos` : (pack?.name || order.mlItemId)}
                            </p>
                            <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground mt-0.5">
                              {order.logisticType === "self_service" ? (
                                <span className="text-[9px] font-semibold text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded">FLEX</span>
                              ) : (
                                <span className="text-[9px] font-semibold text-blue-600 bg-blue-500/10 px-1.5 py-0.5 rounded">ME</span>
                              )}
                              {isMulti && <span className="text-[10px] font-semibold text-purple-500 bg-purple-500/10 px-1.5 py-0.5 rounded">MULTI</span>}
                              <span className="font-semibold text-foreground">×{order.quantity}</span>
                              <span className="text-border">·</span>
                              <span className="mono text-[9px] select-all">{order.mlPackId ? `Pack: ${order.mlPackId}` : `Venta: ${order.mlOrderId}`}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {order.shipmentId && (
                              <button
                                onClick={() => printLabel(order.shipmentId!)}
                                className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
                                title="Etiqueta ML"
                              >
                                <Printer className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Dates row */}
                        <div className="flex items-center gap-2 flex-wrap text-[10px]">
                          <span className="text-muted-foreground">
                            Venta: {new Date(order.dateCreated).toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {order.shippingDeadline && (
                            <>
                              <span className="text-muted-foreground">·</span>
                              <span className={`font-semibold px-1.5 py-0.5 rounded text-[9px] ${urgency.cls}`}>
                                Enviar antes: {formatDeadlineFull(order.shippingDeadline)}
                              </span>
                            </>
                          )}
                        </div>

                        <div className="border-t border-border pt-1.5 space-y-0.5">
                          {allItemGroups.map(({ items, qty }, gi) => (
                            items.map((item, idx) => {
                              const totalNeeded = item.quantity * qty;
                              const label = itemLabel(item);
                              return (
                                <div key={`${gi}-${idx}`} className="flex items-center justify-between text-[11px]">
                                  <span className="text-muted-foreground">
                                    {totalNeeded}× {label}
                                  </span>
                                  <span className="mono text-[10px] text-muted-foreground">
                                    ({item.productVariant.stock} en stock)
                                  </span>
                                </div>
                              );
                            })
                          ))}
                        </div>

                        <PrepActions orderId={order.orderIds.join(",")} currentStatus={order.prepStatus} shippingStatus={order.shippingStatus} />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancelled orders */}
      {cancelledOrders.length > 0 && (
        <div className="space-y-3 mt-6 pt-6 border-t border-border">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
            <h2 className="text-[14px] font-semibold text-muted-foreground">Canceladas ({cancelledOrders.length})</h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cancelledOrders.map((co) => {
              const pack = co.listing?.pack;
              return (
                <div key={co.id} className="rounded-xl border border-red-300 dark:border-red-800/50 bg-card glass px-3 py-2.5 space-y-2 opacity-70">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {pack?.imageUrl && (
                      <div className="shrink-0 h-10 w-10 rounded-md overflow-hidden border bg-muted">
                        <Image src={pack.imageUrl} alt={pack.name} width={40} height={40} className="h-full w-full object-cover" unoptimized />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[12px] truncate">{pack?.name || co.mlItemId}</p>
                      <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground mt-0.5">
                        <span className="text-[9px] font-semibold text-red-600 bg-red-500/10 px-1.5 py-0.5 rounded">CANCELADA</span>
                        <span className="font-semibold text-foreground">×{co.quantity}</span>
                        <span className="text-border">·</span>
                        <span className="mono text-[9px] select-all">{co.mlPackId ? `Pack: ${co.mlPackId}` : `Venta: ${co.mlOrderId}`}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>Venta: {new Date(co.dateCreated).toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  {pack?.items && pack.items.length > 0 && (
                    <div className="border-t border-border pt-1.5 space-y-0.5">
                      {pack.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>{item.quantity * co.quantity}× {itemLabel(item)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
