import { prisma } from "@/lib/prisma";
import { getRealMpBalance, type RealMpBalance } from "@/lib/mp/balance";

const r2 = (n: number) => Math.round(n * 100) / 100;

// Account names that ARE the Mercado Pago wallet (expenses tagged here leave the MP balance).
const MP_ACCOUNT_NAMES = ["mercado pago", "mercadopago", "mp"];

export interface ReconFlag {
  level: "warn" | "info";
  label: string;
  detail: string;
  amount?: number;
}

export interface Reconciliation {
  // Cash-in / cash-out that move the MP wallet
  ventasNetas: number;      // Σ sale.balanceChange (already net of comisión+envío), excl. devueltas
  flexNeto: number;         // Σ balanceChange of flex_cost (−) + flex_bonificacion (+)
  retiros: number;          // Σ Withdrawal.amount
  gastosDesdeMP: number;    // Σ Expense.amount paid from a Mercado Pago account
  saldoLibros: number;      // expected MP balance from our books
  // Reality
  real: RealMpBalance;
  diferencia: number;       // saldoLibros − real.total  (≈0 == cuadrado)
  cuadrado: boolean;
  // Transparency / itemization
  ventasBrutas: number;
  comisiones: number;
  envios: number;
  devueltasExcluidas: number;
  devolucionesParciales: number;
  hasMpAccount: boolean;
  flags: ReconFlag[];
}

export async function computeReconciliation(): Promise<Reconciliation> {
  const [txns, withdrawals, returnedOrders, partialOrders, accounts] = await Promise.all([
    prisma.mPTransaction.findMany({
      select: { amount: true, balanceChange: true, label: true, type: true, mlOrderId: true, quantity: true },
    }),
    prisma.withdrawal.findMany({ select: { amount: true } }),
    prisma.mLOrder.findMany({
      where: { shippingStatus: { in: ["RETURNED", "NOT_DELIVERED"] } },
      select: { mlOrderId: true },
    }),
    prisma.mLOrder.findMany({
      where: { partialRefundQty: { gt: 0 }, shippingStatus: { notIn: ["RETURNED", "NOT_DELIVERED"] } },
      select: { mlOrderId: true, partialRefundQty: true },
    }),
    prisma.account.findMany({ select: { id: true, name: true } }),
  ]);

  const returned = new Set(returnedOrders.map((o) => o.mlOrderId));
  const partialMap = new Map(partialOrders.map((o) => [o.mlOrderId, o.partialRefundQty]));
  const mpAccountIds = new Set(
    accounts.filter((a) => MP_ACCOUNT_NAMES.includes(a.name.trim().toLowerCase())).map((a) => a.id)
  );

  let ventasNetas = 0, flexNeto = 0, ventasBrutas = 0, comisiones = 0, envios = 0, devueltasExcluidas = 0, devolucionesParciales = 0;
  for (const t of txns) {
    const bc = Number(t.balanceChange);
    const amt = Number(t.amount);
    // Fully returned orders never net into MP (credit then refund debit) → skip ALL their rows.
    if (t.mlOrderId && returned.has(t.mlOrderId)) {
      if (t.label === "sale") devueltasExcluidas += amt;
      continue;
    }
    if (t.label === "sale") {
      // Partial refunds aren't synced as a debit row → estimate the net refunded portion and remove it.
      const prQty = t.mlOrderId ? partialMap.get(t.mlOrderId) : undefined;
      if (prQty && prQty > 0 && t.quantity > 0) {
        const refundedNet = (bc * Math.min(prQty, t.quantity)) / t.quantity;
        ventasNetas += bc - refundedNet;
        devolucionesParciales += refundedNet;
      } else {
        ventasNetas += bc;       // already net of comisión + envío (see mp/client sync)
      }
      ventasBrutas += amt;
    } else if (t.label === "flex_cost" || t.label === "flex_bonificacion") {
      flexNeto += bc;          // signed: flex_cost negative, flex_bonificacion positive
    } else if (t.label === "fee" || t.label === "commission") {
      comisiones += Math.abs(amt);   // itemized only — NOT subtracted again (already in ventasNetas)
    } else if (t.label === "shipping") {
      envios += Math.abs(amt);       // itemized only — NOT subtracted again
    }
  }

  const retiros = withdrawals.reduce((s, w) => s + Number(w.amount), 0);

  let gastosDesdeMP = 0;
  if (mpAccountIds.size > 0) {
    const mpExpenses = await prisma.expense.findMany({
      where: { accountId: { in: [...mpAccountIds] }, type: { in: ["gasto", "compra"] } },
      select: { amount: true },
    });
    gastosDesdeMP = mpExpenses.reduce((s, e) => s + Number(e.amount), 0);
  }

  // Inflows (ventas netas + flex) − outflows (retiros = withdrawals, gastosDesdeMP = expenses paid from the MP wallet).
  const saldoLibros = ventasNetas + flexNeto - retiros - gastosDesdeMP;
  const real = await getRealMpBalance();
  const diferencia = r2(saldoLibros - real.total);
  const cuadrado = real.source !== "none" && Math.abs(diferencia) < 100;

  const flags: ReconFlag[] = [];
  if (real.source === "none") {
    flags.push({ level: "warn", label: "Falta saldo real de MP", detail: "Ingresa el saldo real de Mercado Pago (disponible + a liberar) o autoriza el scope de MP para la comparación automática." });
  }
  if (mpAccountIds.size === 0) {
    flags.push({ level: "info", label: "Sin cuenta Mercado Pago", detail: "No hay una cuenta llamada 'Mercado Pago'. Los gastos pagados desde MP se asumen en $0." });
  }
  if (real.source === "manual") {
    flags.push({ level: "info", label: "Saldo real manual", detail: `Capturado manualmente${real.asOf ? ` el ${new Date(real.asOf).toLocaleString("es-MX")}` : ""}. Autoriza el scope de MP para que sea automático.` });
  }
  if (partialMap.size > 0) {
    flags.push({ level: "warn", label: "Reembolsos parciales", detail: `${partialMap.size} orden(es) con reembolso parcial. Se restó el monto neto estimado; no hay registro exacto del reembolso en MP, puede causar una pequeña diferencia.`, amount: r2(devolucionesParciales) });
  }

  return {
    ventasNetas: r2(ventasNetas), flexNeto: r2(flexNeto), retiros: r2(retiros), gastosDesdeMP: r2(gastosDesdeMP),
    saldoLibros: r2(saldoLibros), real, diferencia, cuadrado,
    ventasBrutas: r2(ventasBrutas), comisiones: r2(comisiones), envios: r2(envios), devueltasExcluidas: r2(devueltasExcluidas),
    devolucionesParciales: r2(devolucionesParciales), hasMpAccount: mpAccountIds.size > 0, flags,
  };
}
