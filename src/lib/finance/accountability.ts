import { prisma } from "@/lib/prisma";
import { getRealMpBalance, type RealMpBalance } from "@/lib/mp/balance";
import { STOCK_SYNC_GROUPS } from "@/lib/stock/sync";

const r2 = (n: number) => Math.round(n * 100) / 100;
const NONE = "__none__";

// ── Shapes ──────────────────────────────────────────────────────────────────
export interface ProductLine {
  productId: string | null;
  productName: string;
  vendido: number;          // net sales into MP for this product, from startDate
  inventarioValor: number;  // current stock × ML unit price
  unidades: number;         // current units in stock
}

export interface GroupAccountability {
  groupId: string | null;
  groupName: string;
  groupColor: string;
  vendido: number;          // net ML sales into MP (from startDate, excl. returned/manual)
  gastos: number;           // expenses paid from MP (from startDate)
  retiros: number;          // withdrawals (from startDate, excl. venta_directa)
  esperado: number;         // vendido − gastos − retiros = should still be in MP
  saldoMpAsignado: number;  // real MP balance allocated to this group (proportional)
  descuadre: number;        // esperado − saldoMpAsignado  (>0 falta en MP, <0 retirado de más)
  inventarioValor: number;  // current stock × ML unit price (future income, gross)
  inventarioNeto: number;   // × netRatio = avg money in after ML costs
  unidades: number;
  products: ProductLine[];
}

export interface Accountability {
  startDate: string | null;
  real: RealMpBalance;
  // Global flows (from startDate)
  vendido: number;
  gastos: number;
  retiros: number;
  esperado: number;         // vendido − gastos − retiros
  descuadre: number;        // esperado − real.total
  inventarioValor: number;  // total future income (current stock × ML list price, gross)
  inventarioNeto: number;   // inventarioValor × netRatio = avg money in AFTER ML costs (comisión + envío)
  netRatio: number;         // avg net/gross from real sales (0-1); averages over all shipping types
  unidades: number;
  hasMpAccount: boolean;
  byGroup: GroupAccountability[];
}

const MP_ACCOUNT_NAMES = ["mercado pago", "mercadopago", "mp"];

interface Acc {
  vendido: number; gastos: number; retiros: number; inventarioValor: number; unidades: number;
  products: Map<string, { name: string; vendido: number; inventarioValor: number; unidades: number }>;
}

/**
 * Accountability reconciliation, all-time FROM a single start date.
 * Identity: Vendido − Gastos − Retirado − SaldoMP = Descuadre (≈0 = cuadrado).
 * Inventory (stock × ML listing unit price) is shown separately as future income.
 */
export async function computeAccountability(startDateISO?: string | null): Promise<Accountability> {
  const start = startDateISO ? new Date(startDateISO) : null;
  const dateGte = start ? { gte: start } : undefined;

  const [txns, withdrawals, returnedOrders, partialOrders, accounts, groups, listings, variants] =
    await Promise.all([
      prisma.mPTransaction.findMany({
        where: { NOT: { source: "manual" }, ...(dateGte ? { dateCreated: dateGte } : {}) },
        select: { id: true, amount: true, balanceChange: true, label: true, mlOrderId: true, quantity: true, packId: true },
      }),
      prisma.withdrawal.findMany({
        where: { NOT: { method: "venta_directa" }, ...(dateGte ? { date: dateGte } : {}) },
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
          id: true, name: true, color: true,
          items: { select: { product: { select: { id: true, name: true, supplierCode: true, variants: { select: { id: true, stock: true, packItems: { select: { packId: true } } } } } } } },
        },
      }),
      // Active listings with a price → used for the per-unit ML price map.
      prisma.mLListing.findMany({
        where: { currentPrice: { not: null } },
        select: { packId: true, currentPrice: true, pack: { select: { items: { select: { productVariantId: true, quantity: true } } } } },
      }),
      prisma.productVariant.findMany({ select: { id: true, stock: true } }),
    ]);

  const returned = new Set(returnedOrders.map((o) => o.mlOrderId));
  const partialMap = new Map(partialOrders.map((o) => [o.mlOrderId, o.partialRefundQty]));
  const mpAccountIds = new Set(accounts.filter((a) => MP_ACCOUNT_NAMES.includes(a.name.trim().toLowerCase())).map((a) => a.id));

  // pack → group, product → group, variant → product, group/product metadata
  const packToGroup = new Map<string, string>();
  const packToProduct = new Map<string, string>();
  const productToGroup = new Map<string, string>();
  const groupInfo = new Map<string, { name: string; color: string }>();
  const productName = new Map<string, string>();
  for (const g of groups) {
    groupInfo.set(g.id, { name: g.name, color: g.color });
    for (const item of g.items) {
      const p = item.product;
      productToGroup.set(p.id, g.id);
      productName.set(p.id, p.name);
      for (const v of p.variants) {
        for (const pi of v.packItems) {
          if (!packToGroup.has(pi.packId)) packToGroup.set(pi.packId, g.id);
          if (!packToProduct.has(pi.packId)) packToProduct.set(pi.packId, p.id);
        }
      }
    }
  }

  // variant → unit ML price: prefer the price of a 1-unit pack; else the min per-unit across packs.
  const unitPrice = new Map<string, number>();
  const unitPriceUnits = new Map<string, number>(); // tie-break: fewer units = closer to retail unit price
  for (const l of listings) {
    const price = Number(l.currentPrice);
    if (!price || !l.pack) continue;
    const totalUnits = l.pack.items.reduce((s, it) => s + it.quantity, 0);
    if (totalUnits <= 0) continue;
    const per = price / totalUnits;
    for (const it of l.pack.items) {
      const prevUnits = unitPriceUnits.get(it.productVariantId);
      if (prevUnits === undefined || totalUnits < prevUnits) {
        unitPrice.set(it.productVariantId, per);
        unitPriceUnits.set(it.productVariantId, totalUnits);
      }
    }
  }

  const gmap = new Map<string, Acc>();
  const gacc = (gid: string | null): Acc => {
    const k = gid ?? NONE;
    let a = gmap.get(k);
    if (!a) { a = { vendido: 0, gastos: 0, retiros: 0, inventarioValor: 0, unidades: 0, products: new Map() }; gmap.set(k, a); }
    return a;
  };
  const pacc = (a: Acc, pid: string | null, name: string) => {
    const k = pid ?? NONE;
    let p = a.products.get(k);
    if (!p) { p = { name, vendido: 0, inventarioValor: 0, unidades: 0 }; a.products.set(k, p); }
    return p;
  };

  // ── Vendido (net ML sales into MP) ──
  let vendido = 0, grossSales = 0;
  for (const t of txns) {
    if (t.label !== "sale") continue;
    if (t.mlOrderId && returned.has(t.mlOrderId)) continue; // fully returned → never nets into MP
    const bc = Number(t.balanceChange);
    let net = bc;
    const prQty = t.mlOrderId ? partialMap.get(t.mlOrderId) : undefined;
    if (prQty && prQty > 0 && t.quantity > 0) net = bc - (bc * Math.min(prQty, t.quantity)) / t.quantity;
    // gross (for the net/gross ratio) — same partial-refund proportion
    let gross = Number(t.amount);
    if (prQty && prQty > 0 && t.quantity > 0) gross = gross - (gross * Math.min(prQty, t.quantity)) / t.quantity;
    grossSales += gross;
    const gid = t.packId ? (packToGroup.get(t.packId) ?? null) : null;
    const a = gacc(gid);
    a.vendido += net;
    vendido += net;
    // attribute to a product via the pack's first variant's product
    // (packToGroup already resolved; for product we need the pack items — approximate via group products later)
    if (t.packId) {
      const pid = packToProduct.get(t.packId) ?? null;
      pacc(a, pid, pid ? (productName.get(pid) ?? "?") : "Sin producto").vendido += net;
    } else {
      pacc(a, null, "Sin producto").vendido += net;
    }
  }

  // ── Gastos (paid from MP) ──
  let gastos = 0;
  const mpExpenses = mpAccountIds.size > 0
    ? await prisma.expense.findMany({
        where: { accountId: { in: [...mpAccountIds] }, type: { in: ["gasto", "compra"] }, ...(dateGte ? { date: dateGte } : {}) },
        select: { amount: true, productGroupId: true, packId: true, productId: true },
      })
    : [];
  for (const e of mpExpenses) {
    const amt = Number(e.amount);
    let gid: string | null = null;
    if (e.productGroupId) gid = e.productGroupId;
    else if (e.packId) gid = packToGroup.get(e.packId) ?? null;
    else if (e.productId) gid = productToGroup.get(e.productId) ?? null;
    gacc(gid).gastos += amt;
    gastos += amt;
  }

  // ── Retiros ──
  let retiros = 0;
  for (const w of withdrawals) {
    const amt = Number(w.amount);
    retiros += amt;
    if (w.productGroupId) gacc(w.productGroupId).retiros += amt;
    else if (w.allocations.length > 0) {
      let allocated = 0;
      for (const al of w.allocations) {
        const gid = al.packId ? (packToGroup.get(al.packId) ?? null) : al.productId ? (productToGroup.get(al.productId) ?? null) : null;
        gacc(gid).retiros += Number(al.amount);
        allocated += Number(al.amount);
      }
      const rem = amt - allocated;
      if (Math.abs(rem) > 0.005) gacc(null).retiros += rem;
    } else gacc(null).retiros += amt;
  }

  // ── Inventario @ ML price (current, point-in-time) ──
  // Skip AUTO- products (virtual listing stock, not real merchandise) and mirror duplicates
  // of a stock-sync group (Playera Normal/Oversized + DL360p x5 = same physical inventory).
  const mirrorSkip = new Set<string>();
  for (const grp of STOCK_SYNC_GROUPS) for (let i = 1; i < grp.length; i++) mirrorSkip.add(grp[i]);
  let inventarioValor = 0, unidades = 0;
  const stockMap = new Map(variants.map((v) => [v.id, v.stock]));
  for (const g of groups) {
    const a = gacc(g.id);
    for (const item of g.items) {
      const p = item.product;
      if (p.supplierCode?.startsWith("AUTO-") || mirrorSkip.has(p.id)) continue;
      for (const v of p.variants) {
        const st = stockMap.get(v.id) ?? v.stock;
        if (st <= 0) continue;
        const val = st * (unitPrice.get(v.id) ?? 0);
        a.inventarioValor += val; a.unidades += st;
        inventarioValor += val; unidades += st;
        const pl = pacc(a, p.id, p.name); pl.inventarioValor += val; pl.unidades += st;
      }
    }
  }

  // Average money that actually lands after ML costs (comisión + envío), averaged over
  // every real sale → applied to the gross inventory value. "Avg" because shipping type varies.
  const netRatio = grossSales > 0 ? vendido / grossSales : 0;
  const inventarioNeto = r2(inventarioValor * netRatio);

  // ── MP balance + descuadre ──
  const real = await getRealMpBalance();
  const esperado = vendido - gastos - retiros;
  const descuadre = r2(esperado - real.total);

  // Allocate the single real MP balance to groups proportional to positive "esperado".
  const posEsp = [...gmap.values()].reduce((s, a) => s + Math.max(0, a.vendido - a.gastos - a.retiros), 0);

  const byGroup: GroupAccountability[] = [];
  for (const [k, a] of gmap) {
    if (a.vendido === 0 && a.gastos === 0 && a.retiros === 0 && a.inventarioValor === 0) continue;
    const gid = k === NONE ? null : k;
    const info = gid ? groupInfo.get(gid) : null;
    const esp = a.vendido - a.gastos - a.retiros;
    const asignado = posEsp > 0 ? (real.total * Math.max(0, esp)) / posEsp : 0;
    const products: ProductLine[] = [...a.products.entries()]
      .map(([pk, p]) => ({ productId: pk === NONE ? null : pk, productName: p.name, vendido: r2(p.vendido), inventarioValor: r2(p.inventarioValor), unidades: p.unidades }))
      .filter((p) => p.vendido !== 0 || p.inventarioValor !== 0)
      .sort((x, y) => (y.vendido + y.inventarioValor) - (x.vendido + x.inventarioValor));
    byGroup.push({
      groupId: gid,
      groupName: info?.name ?? "Sin grupo",
      groupColor: info?.color ?? "#9ca3af",
      vendido: r2(a.vendido), gastos: r2(a.gastos), retiros: r2(a.retiros),
      esperado: r2(esp), saldoMpAsignado: r2(asignado), descuadre: r2(esp - asignado),
      inventarioValor: r2(a.inventarioValor), inventarioNeto: r2(a.inventarioValor * netRatio), unidades: a.unidades, products,
    });
  }
  byGroup.sort((x, y) => Math.abs(y.descuadre) - Math.abs(x.descuadre));

  return {
    startDate: startDateISO ?? null,
    real,
    vendido: r2(vendido), gastos: r2(gastos), retiros: r2(retiros),
    esperado: r2(esperado), descuadre,
    inventarioValor: r2(inventarioValor), inventarioNeto, netRatio: r2(netRatio), unidades,
    hasMpAccount: mpAccountIds.size > 0,
    byGroup,
  };
}
