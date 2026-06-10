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

// Per-product-group slice of the MP cash reconciliation. The MP wallet is one pool fed by
// every group, but each group's owner withdraws their own share — so the reconciliation is
// only meaningful PER GROUP: how much of a group's net sales should still be sitting in MP.
export interface GroupReconciliation {
  groupId: string | null;
  groupName: string;
  groupColor: string;
  ventasNetas: number;          // Σ sale.balanceChange for this group (net of comisión+envío)
  flexNeto: number;
  retiros: number;              // withdrawals attributed to this group
  gastosDesdeMP: number;        // MP-account expenses attributed to this group
  saldoLibros: number;          // ventasNetas + flexNeto − retiros − gastosDesdeMP
  // "Dinero a Retirar" (P&L base, MISMA definición que flujo-caja): ventas netas + flex
  // − retiros − TODOS los gastos/compras (cualquier cuenta), SIN restar costo de producto
  // (COGS). Ads se restan en el cliente (son por producto). Pre-ads aquí.
  aRetirarPreAds: number;
  gastosTotal: number;          // gastos op. (cualquier cuenta)
  comprasTotal: number;         // compras de producto (cualquier cuenta)
  ventasBrutas: number;
  devolucionesParciales: number;
  salesCount: number;
}

export interface Reconciliation {
  // Cash-in / cash-out that move the MP wallet
  ventasNetas: number;      // Σ sale.balanceChange (already net of comisión+envío), excl. devueltas
  flexNeto: number;         // Σ balanceChange of flex_cost (−) + flex_bonificacion (+)
  retiros: number;          // Σ Withdrawal.amount
  gastosDesdeMP: number;    // Σ Expense.amount paid from a Mercado Pago account
  saldoLibros: number;      // expected MP balance from our books
  // "Dinero a Retirar" total (P&L, pre-ads) = Σ por grupo. Ads se restan en el cliente.
  aRetirarTotalPreAds: number;
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
  byGroup: GroupReconciliation[];
}

const NONE = "__none__";

interface GroupAcc {
  ventasNetas: number;
  flexNeto: number;
  retiros: number;
  gastosDesdeMP: number;
  gastosTotal: number;
  comprasTotal: number;
  ventasBrutas: number;
  devolucionesParciales: number;
  salesCount: number;
}

export async function computeReconciliation(): Promise<Reconciliation> {
  const [txns, withdrawals, returnedOrders, partialOrders, accounts, groups] = await Promise.all([
    // Solo transacciones reales de la billetera MP. Las ventas MANUALES (efectivo/banco
    // fuera de ML) NO entraron a MercadoPago, asi que se excluyen de la conciliacion del
    // saldo MP para no crear un descuadre fantasma (si SI cuentan en flujo-caja/utilidad).
    prisma.mPTransaction.findMany({
      where: { NOT: { source: "manual" } },
      select: { id: true, amount: true, balanceChange: true, label: true, type: true, mlOrderId: true, quantity: true, packId: true },
    }),
    prisma.withdrawal.findMany({
      select: { amount: true, productGroupId: true, allocations: { select: { amount: true, packId: true, productId: true } } },
    }),
    prisma.mLOrder.findMany({
      where: { shippingStatus: { in: ["RETURNED", "NOT_DELIVERED"] } },
      select: { mlOrderId: true },
    }),
    prisma.mLOrder.findMany({
      where: { partialRefundQty: { gt: 0 }, shippingStatus: { notIn: ["RETURNED", "NOT_DELIVERED"] } },
      select: { mlOrderId: true, partialRefundQty: true },
    }),
    prisma.account.findMany({ select: { id: true, name: true } }),
    prisma.productGroup.findMany({
      select: {
        id: true,
        name: true,
        color: true,
        items: { select: { product: { select: { id: true, variants: { select: { packItems: { select: { packId: true } } } } } } } },
      },
    }),
  ]);

  const returned = new Set(returnedOrders.map((o) => o.mlOrderId));
  const partialMap = new Map(partialOrders.map((o) => [o.mlOrderId, o.partialRefundQty]));
  const mpAccountIds = new Set(
    accounts.filter((a) => MP_ACCOUNT_NAMES.includes(a.name.trim().toLowerCase())).map((a) => a.id)
  );

  // Map pack/product → group (first-wins, matching the "Detalle por Grupo" table in page.tsx),
  // plus tx.id → packId for expenses attributed via transactionIds.
  const packToGroup = new Map<string, string>();
  const productToGroup = new Map<string, string>();
  const groupInfo = new Map<string, { name: string; color: string }>();
  for (const g of groups) {
    groupInfo.set(g.id, { name: g.name, color: g.color });
    for (const item of g.items) {
      productToGroup.set(item.product.id, g.id);
      for (const v of item.product.variants) {
        for (const pi of v.packItems) {
          if (!packToGroup.has(pi.packId)) packToGroup.set(pi.packId, g.id);
        }
      }
    }
  }
  const txToPack = new Map<string, string>();
  for (const t of txns) if (t.packId) txToPack.set(t.id, t.packId);

  const gmap = new Map<string, GroupAcc>();
  const gacc = (gid: string | null): GroupAcc => {
    const k = gid ?? NONE;
    let a = gmap.get(k);
    if (!a) {
      a = { ventasNetas: 0, flexNeto: 0, retiros: 0, gastosDesdeMP: 0, gastosTotal: 0, comprasTotal: 0, ventasBrutas: 0, devolucionesParciales: 0, salesCount: 0 };
      gmap.set(k, a);
    }
    return a;
  };

  let ventasNetas = 0, flexNeto = 0, ventasBrutas = 0, comisiones = 0, envios = 0, devueltasExcluidas = 0, devolucionesParciales = 0;
  for (const t of txns) {
    const bc = Number(t.balanceChange);
    const amt = Number(t.amount);
    // Fully returned orders never net into MP (credit then refund debit) → skip ALL their rows.
    if (t.mlOrderId && returned.has(t.mlOrderId)) {
      if (t.label === "sale") devueltasExcluidas += amt;
      continue;
    }
    const gid = t.packId ? (packToGroup.get(t.packId) ?? null) : null;
    const a = gacc(gid);
    if (t.label === "sale") {
      // Partial refunds aren't synced as a debit row → estimate the net refunded portion and remove it.
      const prQty = t.mlOrderId ? partialMap.get(t.mlOrderId) : undefined;
      if (prQty && prQty > 0 && t.quantity > 0) {
        const refundedNet = (bc * Math.min(prQty, t.quantity)) / t.quantity;
        ventasNetas += bc - refundedNet;
        devolucionesParciales += refundedNet;
        a.ventasNetas += bc - refundedNet;
        a.devolucionesParciales += refundedNet;
      } else {
        ventasNetas += bc;       // already net of comisión + envío (see mp/client sync)
        a.ventasNetas += bc;
      }
      ventasBrutas += amt;
      a.ventasBrutas += amt;
      a.salesCount += t.quantity;
    } else if (t.label === "flex_cost" || t.label === "flex_bonificacion") {
      flexNeto += bc;          // signed: flex_cost negative, flex_bonificacion positive
      a.flexNeto += bc;
    } else if (t.label === "fee" || t.label === "commission") {
      comisiones += Math.abs(amt);   // itemized only — NOT subtracted again (already in ventasNetas)
    } else if (t.label === "shipping") {
      envios += Math.abs(amt);       // itemized only — NOT subtracted again
    }
  }

  let retiros = 0;
  for (const w of withdrawals) {
    const amt = Number(w.amount);
    retiros += amt;
    if (w.productGroupId) {
      gacc(w.productGroupId).retiros += amt;            // direct FK
    } else if (w.allocations.length > 0) {
      let allocated = 0;
      for (const al of w.allocations) {                  // split by pack/product
        const gid = al.packId
          ? (packToGroup.get(al.packId) ?? null)
          : al.productId
          ? (productToGroup.get(al.productId) ?? null)
          : null;
        const av = Number(al.amount);
        gacc(gid).retiros += av;
        allocated += av;
      }
      // Guarantee the per-group rows foot to the global total even if allocations are incomplete.
      const rem = amt - allocated;
      if (Math.abs(rem) > 0.005) gacc(null).retiros += rem;
    } else {
      gacc(null).retiros += amt;                         // unallocated → Sin grupo
    }
  }

  // Load ALL gasto/compra expenses once: every one reduces the P&L "a retirar"; only those
  // paid from an MP account also reduce the literal MP cash balance (gastosDesdeMP).
  let gastosDesdeMP = 0, gastosTotal = 0, comprasTotal = 0;
  const allExpenses = await prisma.expense.findMany({
    where: { type: { in: ["gasto", "compra"] } },
    select: { amount: true, type: true, accountId: true, productGroupId: true, packId: true, productId: true, transactionIds: true },
  });
  for (const e of allExpenses) {
    const amt = Number(e.amount);
    let gid: string | null = null;
    if (e.productGroupId) gid = e.productGroupId;
    else if (e.packId) gid = packToGroup.get(e.packId) ?? null;
    else if (e.productId) gid = productToGroup.get(e.productId) ?? null;
    else if (e.transactionIds) {
      for (const txId of e.transactionIds.split(",").filter(Boolean)) {
        const pId = txToPack.get(txId);
        if (pId) { gid = packToGroup.get(pId) ?? null; break; }
      }
    }
    const a = gacc(gid);
    if (e.type === "compra") { comprasTotal += amt; a.comprasTotal += amt; }
    else { gastosTotal += amt; a.gastosTotal += amt; }
    if (e.accountId && mpAccountIds.has(e.accountId)) { gastosDesdeMP += amt; a.gastosDesdeMP += amt; }
  }

  // Inflows (ventas netas + flex) − outflows (retiros = withdrawals, gastosDesdeMP = expenses paid from the MP wallet).
  const saldoLibros = ventasNetas + flexNeto - retiros - gastosDesdeMP;
  // "Dinero a Retirar" (P&L, pre-ads): ventas netas + flex − retiros − TODOS los gastos/compras
  // (cualquier cuenta), SIN restar costo de producto (COGS). = misma base que flujo-caja.
  const aRetirarTotalPreAds = ventasNetas + flexNeto - retiros - gastosTotal - comprasTotal;
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

  const byGroup: GroupReconciliation[] = [];
  for (const [k, a] of gmap) {
    // Skip groups with no activity at all (e.g. a group whose only orders were fully returned).
    if (a.ventasNetas === 0 && a.flexNeto === 0 && a.retiros === 0 && a.gastosDesdeMP === 0 && a.gastosTotal === 0 && a.comprasTotal === 0 && a.ventasBrutas === 0 && a.devolucionesParciales === 0) continue;
    const gid = k === NONE ? null : k;
    const info = gid ? groupInfo.get(gid) : null;
    byGroup.push({
      groupId: gid,
      groupName: info?.name ?? "Sin grupo",
      groupColor: info?.color ?? "#9ca3af",
      ventasNetas: r2(a.ventasNetas),
      flexNeto: r2(a.flexNeto),
      retiros: r2(a.retiros),
      gastosDesdeMP: r2(a.gastosDesdeMP),
      saldoLibros: r2(a.ventasNetas + a.flexNeto - a.retiros - a.gastosDesdeMP),
      aRetirarPreAds: r2(a.ventasNetas + a.flexNeto - a.retiros - a.gastosTotal - a.comprasTotal),
      gastosTotal: r2(a.gastosTotal),
      comprasTotal: r2(a.comprasTotal),
      ventasBrutas: r2(a.ventasBrutas),
      devolucionesParciales: r2(a.devolucionesParciales),
      salesCount: a.salesCount,
    });
  }
  // Largest "still-in-MP" first — the groups most likely hiding unrecorded retiros surface at the top.
  byGroup.sort((x, y) => y.saldoLibros - x.saldoLibros);

  return {
    ventasNetas: r2(ventasNetas), flexNeto: r2(flexNeto), retiros: r2(retiros), gastosDesdeMP: r2(gastosDesdeMP),
    saldoLibros: r2(saldoLibros), aRetirarTotalPreAds: r2(aRetirarTotalPreAds), real, diferencia, cuadrado,
    ventasBrutas: r2(ventasBrutas), comisiones: r2(comisiones), envios: r2(envios), devueltasExcluidas: r2(devueltasExcluidas),
    devolucionesParciales: r2(devolucionesParciales), hasMpAccount: mpAccountIds.size > 0, flags, byGroup,
  };
}
