"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";

function fmt(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

interface AccountInfo {
  id: string;
  name: string;
  color: string;
}

interface DeductionItem {
  label: string;
  value: number;
}

interface Props {
  totalIncome: number;
  salesCount: number;
  totalUnits: number;
  totalDeducciones: number;
  deductionItems: DeductionItem[];
  serverNet: number;
  serverAvailable: number;
  serverAdsCost: number;
  totalWithdrawn: number;
  totalGastos: number;
  totalCompras: number;
  totalFacturaCost: number;
  totalFlexCost: number;
  totalFlexBonif: number;
  flexCount: number;
  flexPaidCount: number;
  flexUnpaidCost: number;
  totalFlexPaid: number;
  gastosByAccount: Record<string, number>;
  accounts: AccountInfo[];
  showWithdraw: boolean;
  totalFacturasEmitidas?: number;
  hasFacturaSobreMercancia?: boolean;
}

export function FinancialCardsWrapper({
  totalIncome, salesCount, totalUnits, totalDeducciones, deductionItems,
  serverNet, serverAvailable, serverAdsCost, totalWithdrawn, totalGastos, totalFacturaCost,
  totalFlexCost, totalFlexBonif, flexCount, flexPaidCount, flexUnpaidCost, totalFlexPaid, totalCompras, gastosByAccount, accounts, showWithdraw,
  totalFacturasEmitidas = 0, hasFacturaSobreMercancia = false,
}: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [depositing, setDepositing] = useState(false);
  const [payingFlex, setPayingFlex] = useState(false);
  const [showFlexModal, setShowFlexModal] = useState(false);
  const [flexPayAmount, setFlexPayAmount] = useState("");
  const flexInputRef = useRef<HTMLInputElement>(null);

  const dateFrom = searchParams.get("dateFrom") || "";
  const dateTo = searchParams.get("dateTo") || "";
  const productIds = searchParams.get("productIds") || searchParams.get("productId") || "";
  const packIds = searchParams.get("packIds") || searchParams.get("packId") || "";
  const hasProductFilter = !!(productIds || packIds);

  // Removed auto-sync: it was adding transactions on every page load,
  // causing numbers to change between reloads. Use "Sincronizar MP" button instead.

  const adsCost = serverAdsCost;
  const totalNet = serverNet - adsCost;
  const netAfterFactura = totalFacturaCost > 0 ? totalNet - totalFacturaCost : null;
  const available = serverAvailable - adsCost;

  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  async function handleDeposit() {
    if (available === null || available >= 0) return;
    const depositAmount = Math.round(Math.abs(available) * 100) / 100;
    setDepositing(true);
    try {
      const packIdList = packIds ? packIds.split(",").filter(Boolean) : [];
      const payload: Record<string, unknown> = { amount: -depositAmount, date: new Date().toISOString().split("T")[0], concept: "Deposito a cuenta ML", method: "bank" };
      if (packIdList.length === 1) payload.allocations = [{ packId: packIdList[0], amount: -depositAmount }];
      const res = await fetch("/api/withdrawals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { toast.error("Error al crear deposito"); return; }
      toast.success(`Deposito de ${fmt(depositAmount)} registrado`);
      router.refresh();
    } catch { toast.error("Error de conexion"); } finally { setDepositing(false); }
  }

  const loading = false;

  return (
    <>
      {/* Ingresos — Hero card with left accent */}
      <div className="rounded-xl border border-border bg-card glass p-5 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5 relative overflow-hidden group">
        <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-gradient-to-b from-emerald-400 to-emerald-600" />
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 pl-3">Ingresos</p>
        <p className="text-3xl font-bold num margin-good tracking-tight pl-3">{fmt(totalIncome)}</p>
        <p className="text-[12px] text-muted-foreground mt-2 pl-3">{salesCount} ventas{totalUnits !== salesCount ? ` · ${totalUnits} unidades` : ""}</p>
      </div>

      {/* Costos y Deducciones — Expandable breakdown */}
      <div className="rounded-xl border border-border bg-card glass p-5 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5 relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-gradient-to-b from-rose-400 to-rose-600" />
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 pl-3">Costos y Deducciones</p>
        <p className="text-3xl font-bold num margin-bad tracking-tight pl-3">-{fmt(totalDeducciones + (adsCost || 0))}</p>
        <div className="mt-4 pl-3 space-y-1.5">
          {deductionItems.map((d) => (
            <div key={d.label} className="flex items-center justify-between text-[12px]">
              <span className="text-muted-foreground">{d.label}</span>
              {d.value < 0 ? (
                <span className="num font-medium text-emerald-500">+{fmt(Math.abs(d.value))}</span>
              ) : (
                <span className="num font-medium text-muted-foreground">-{fmt(d.value)}</span>
              )}
            </div>
          ))}
          {adsCost !== null && adsCost > 0 && (
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-muted-foreground">Publicidad</span>
              <span className="num font-medium text-muted-foreground">-{fmt(adsCost)}</span>
            </div>
          )}
        </div>
        {totalIncome > 0 && (
          <div className="mt-3 pt-3 border-t border-border/50 pl-3">
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-rose-400 to-rose-600" style={{ width: `${Math.min(((totalDeducciones + (adsCost || 0)) / totalIncome) * 100, 100)}%` }} />
              </div>
              <span className="text-[11px] font-mono text-muted-foreground">{(((totalDeducciones + (adsCost || 0)) / totalIncome) * 100).toFixed(0)}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Utilidad Neta — Highlighted card */}
      <div className={`rounded-xl border bg-card glass p-5 transition-all duration-300 hover:shadow-lg relative overflow-hidden ${totalNet! >= 0 ? "border-emerald-500/20 hover:shadow-emerald-500/5" : "border-rose-500/20 hover:shadow-rose-500/5"}`}>
        <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${totalNet! >= 0 ? "bg-gradient-to-b from-emerald-400 to-blue-500" : "bg-gradient-to-b from-rose-400 to-orange-500"}`} />
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 pl-3">Utilidad Neta</p>
        <p className={`text-3xl font-bold num tracking-tight pl-3 ${totalNet! >= 0 ? "margin-good" : "margin-bad"}`}>{fmt(totalNet!)}</p>
        <p className="text-[12px] text-muted-foreground mt-2 pl-3">Incluye todos los costos</p>
        {adsCost !== null && adsCost > 0 && <p className="text-[11px] text-pink-500 mt-1 pl-3">Ads: {fmt(adsCost)}</p>}
        {(netAfterFactura !== null || (hasFacturaSobreMercancia && totalFacturasEmitidas > 0)) && (
          <div className="mt-3 pt-3 border-t border-border/50 pl-3 space-y-1">
            {hasFacturaSobreMercancia && totalFacturasEmitidas > 0 && (
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-muted-foreground">Facturas emitidas</span>
                <span className="num font-medium text-blue-500">{fmt(totalFacturasEmitidas)}</span>
              </div>
            )}
            {totalFacturaCost > 0 && (
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-muted-foreground">Base para factura</span>
                <span className="num font-medium text-muted-foreground">{fmt(totalWithdrawn + available)}</span>
              </div>
            )}
            {totalFacturaCost > 0 && (
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-muted-foreground">Factura (3%){hasFacturaSobreMercancia ? " s/mercancia" : ""}</span>
                <span className="num font-medium margin-bad">-{fmt(totalFacturaCost)}</span>
              </div>
            )}
            {netAfterFactura !== null && (
              <div className="flex items-center justify-between text-[13px] font-bold">
                <span className="text-muted-foreground">Despues de factura</span>
                <span className={`num ${netAfterFactura >= 0 ? "margin-good" : "margin-bad"}`}>{fmt(netAfterFactura)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dinero a Retirar + Per-Account Breakdown */}
      {showWithdraw && (
        <div className="rounded-xl border border-border bg-card glass p-5 overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-accent/5 relative">
          <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-gradient-to-b from-blue-400 to-indigo-600" />
          <div className="flex items-center justify-between mb-3 pl-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Dinero a Retirar</p>
            <span className="sw" style={{ background: "oklch(0.55 0.18 260)" }} />
          </div>
          {loading ? (
            <div className="flex items-center gap-2 h-7"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /><span className="text-sm text-muted-foreground">Calculando...</span></div>
          ) : (
            <p className={`text-3xl font-bold num tracking-tight pl-3 ${available! >= 0 ? "margin-good" : "margin-bad"}`}>{fmt(available!)}</p>
          )}
          <div className="text-[12px] text-muted-foreground mt-3 pl-3 space-y-1">
            {adsCost !== null && adsCost > 0 && <p>Ads: -{fmt(adsCost)}</p>}
            {totalGastos > 0 && <p>Gastos: -{fmt(totalGastos)}</p>}
            {totalCompras > 0 && <p>Compra productos: -{fmt(totalCompras)}</p>}
            {totalWithdrawn > 0 && <p>Retirado: {fmt(totalWithdrawn)}</p>}
          </div>

          {/* Per-account breakdown: what to pay to each account */}
          {accounts.length > 0 && Object.keys(gastosByAccount).length > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Pagar a cada cuenta</p>
              <div className="space-y-1">
                {accounts.map((acc) => {
                  if (acc.name.toLowerCase().includes("mercado pago")) return null;
                  const amount = gastosByAccount[acc.id] || 0;
                  if (amount === 0) return null;
                  return (
                    <div key={acc.id} className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: acc.color }} />
                        {acc.name}
                      </span>
                      <span className="num font-medium">{fmt(amount)}</span>
                    </div>
                  );
                })}
                {gastosByAccount["__none__"] > 0 && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Sin cuenta</span>
                    <span className="num font-medium">{fmt(gastosByAccount["__none__"])}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Flex shipping costs — only show when there are flex orders in current filter */}
          {flexCount > 0 && (() => {
            const showPayments = !hasProductFilter;
            const flexBalance = showPayments ? totalFlexPaid - totalFlexCost : -totalFlexCost;
            return (
              <div className="mt-3 pt-3 border-t border-border">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Costo Flex ({flexCount})</span>
                  <span className="num margin-bad font-medium">-{fmt(totalFlexCost)}</span>
                </div>
                {showPayments && totalFlexPaid > 0 && (
                  <div className="flex items-center justify-between text-[11px] mt-0.5">
                    <span className="text-muted-foreground">Pagado</span>
                    <span className="num text-green-600 dark:text-green-400 font-medium">+{fmt(totalFlexPaid)}</span>
                  </div>
                )}
                {showPayments && (
                  <div className="flex items-center justify-between text-[12px] font-semibold mt-1 pt-1 border-t border-border/50">
                    <span className="text-muted-foreground">Saldo Flex</span>
                    <span className={`num ${flexBalance >= 0 ? "margin-good" : "margin-bad"}`}>
                      {flexBalance >= 0 ? "+" : ""}{fmt(flexBalance)}
                    </span>
                  </div>
                )}
                {showPayments && (
                  <button
                    onClick={() => { setFlexPayAmount(""); setShowFlexModal(true); setTimeout(() => flexInputRef.current?.focus(), 100); }}
                    className="mt-1.5 w-full text-[11px] font-medium py-1 px-2 rounded-md border border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 flex items-center justify-center gap-1.5"
                  >
                    Pagar Flex
                  </button>
                )}
              </div>
            );
          })()}

          {/* Flex Payment Modal */}
          {showFlexModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowFlexModal(false)}>
              <div className="bg-card border border-border rounded-lg p-5 w-[320px] shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[14px] font-semibold">Pagar Envios Flex</h3>
                  <button onClick={() => setShowFlexModal(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Costo Flex: {fmt(totalFlexCost)} | Pagado: {fmt(totalFlexPaid)} | Saldo: {fmt(totalFlexPaid - totalFlexCost)}</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">$</span>
                      <input
                        ref={flexInputRef}
                        type="number"
                        step="0.01"
                        value={flexPayAmount}
                        onChange={(e) => setFlexPayAmount(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 text-[14px] rounded-md border border-border bg-background num"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Se descontara de tu cuenta Mercado Pago</p>
                  <button
                    onClick={async () => {
                      const amt = parseFloat(flexPayAmount);
                      if (!amt || amt <= 0) { toast.error("Ingresa un monto valido"); return; }
                      setPayingFlex(true);
                      try {
                        const res = await fetch("/api/flex-pay", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ amount: amt, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }),
                        });
                        if (!res.ok) { toast.error("Error al pagar flex"); return; }
                        const data = await res.json();
                        toast.success(`Pago de ${fmt(amt)} registrado (${data.marked} envios marcados)`);
                        setShowFlexModal(false);
                        router.refresh();
                      } catch { toast.error("Error de conexion"); } finally { setPayingFlex(false); }
                    }}
                    disabled={payingFlex}
                    className="w-full text-[12px] font-medium py-2 rounded-md bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {payingFlex && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Confirmar Pago
                  </button>
                </div>
              </div>
            </div>
          )}

          {available !== null && available < 0 && (
            <button
              onClick={handleDeposit}
              disabled={depositing}
              className="mt-2 w-full text-[12px] font-medium py-1.5 px-3 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1.5 truncate"
            >
              {depositing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Depositar {fmt(Math.abs(available))}
            </button>
          )}
        </div>
      )}
    </>
  );
}
