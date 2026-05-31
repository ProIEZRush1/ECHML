import { prisma } from "@/lib/prisma";

const r2 = (n: number) => Math.round(n * 100) / 100;

export type EstadoKind = "ok" | "transito" | "pendiente" | "devuelto" | "parcial" | "cancelado";

export interface OrderRow {
  id: string;
  mlOrderId: string; // stringified bigint
  mlItemId: string;
  date: string; // ISO
  title: string;
  sku: string | null;
  imageUrl: string | null;
  variantDots: { color: string | null; label: string | null }[];
  quantity: number;
  shippingStatus: string;
  logisticType: string | null;
  buyerNickname: string | null;
  estado: string;
  estadoKind: EstadoKind;
  // economics — every component the user wants to see "de cada cosa"
  vendido: number; // gross sale
  comision: number; // ML fee (positive number = what ML took)
  envio: number; // shipping the seller actually paid (incl. flex net), positive = cost
  costoProd: number; // COGS (product cost), positive = cost
  devolucion: number; // refund returned to buyer (full or estimated partial), positive
  envioExtra: number; // return freight ML charged us, positive
  neto: number; // what's left → win/lose
  hasTxData: boolean; // were MP transactions found for this order (else economics are estimated from totalAmount)
  hasCostData: boolean; // was product cost resolvable
}

export interface OrderSummary {
  count: number;
  vendido: number;
  comision: number;
  envio: number;
  costoProd: number;
  devoluciones: number; // refunds (money back to buyers)
  devolucionesCount: number;
  envioExtra: number; // return freight charged to us
  neto: number;
  netoEntregados: number; // net excluding returned orders (pure delivered profit)
}

const RETURNED = new Set(["RETURNED", "NOT_DELIVERED"]);

function deriveEstado(shippingStatus: string, partialRefundQty: number): { estado: string; kind: EstadoKind } {
  if (shippingStatus === "RETURNED") return { estado: "Devuelto", kind: "devuelto" };
  if (shippingStatus === "NOT_DELIVERED") return { estado: "No entregado", kind: "devuelto" };
  if (shippingStatus === "CANCELLED") return { estado: "Cancelado", kind: "cancelado" };
  if (partialRefundQty > 0) return { estado: "Reembolso parcial", kind: "parcial" };
  if (shippingStatus === "DELIVERED") return { estado: "Entregado", kind: "ok" };
  if (shippingStatus === "SHIPPED") return { estado: "En camino", kind: "transito" };
  if (shippingStatus === "READY_TO_SHIP") return { estado: "Listo", kind: "transito" };
  return { estado: "Pendiente", kind: "pendiente" };
}

/**
 * Per-order economics: for each MLOrder in the range, itemize what was sold, what ML took
 * (comisión, envío), the product cost, and — what matters most — returns (reembolso) and the
 * EXTRA return shipping ML charged us. Net = win/lose per order.
 *
 * Consistency with the cash reconciliation:
 *  - sale.balanceChange is already net of comisión+envío; fee/shipping rows are itemization.
 *  - Fully returned orders (RETURNED/NOT_DELIVERED): the sale is reversed by ML → it nets to ~0;
 *    the real cash loss we still eat is the return freight (returnShipCost). Product is assumed restocked.
 *  - Partial refunds: ML emits no debit row → estimate the refunded net pro-rata (matches reconciliation.ts).
 */
export async function computeOrderEconomics(opts: { from: Date; to: Date }): Promise<{
  rows: OrderRow[];
  summary: OrderSummary;
}> {
  const orders = await prisma.mLOrder.findMany({
    where: { dateCreated: { gte: opts.from, lte: opts.to } },
    orderBy: { dateCreated: "desc" },
  });

  if (orders.length === 0) {
    return {
      rows: [],
      summary: {
        count: 0, vendido: 0, comision: 0, envio: 0, costoProd: 0,
        devoluciones: 0, devolucionesCount: 0, envioExtra: 0, neto: 0, netoEntregados: 0,
      },
    };
  }

  const orderIds = orders.map((o) => o.mlOrderId);
  const mlItemIds = [...new Set(orders.map((o) => o.mlItemId))];

  const [txns, listings] = await Promise.all([
    prisma.mPTransaction.findMany({
      where: { mlOrderId: { in: orderIds } },
      select: { mlOrderId: true, label: true, amount: true, balanceChange: true },
    }),
    prisma.mLListing.findMany({
      where: { mlItemId: { in: mlItemIds } },
      select: {
        mlItemId: true,
        title: true,
        pack: {
          select: {
            sku: true,
            name: true,
            imageUrl: true,
            items: {
              select: {
                quantity: true,
                productVariant: {
                  select: { color: true, variantLabel: true, product: { select: { unitCost: true } } },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  // Group transactions by order
  interface TxAgg { saleAmt: number; saleNet: number; comision: number; envio: number; flexNet: number; count: number }
  const txByOrder = new Map<string, TxAgg>();
  for (const t of txns) {
    if (t.mlOrderId == null) continue;
    const key = t.mlOrderId.toString();
    let a = txByOrder.get(key);
    if (!a) { a = { saleAmt: 0, saleNet: 0, comision: 0, envio: 0, flexNet: 0, count: 0 }; txByOrder.set(key, a); }
    a.count++;
    const amt = Number(t.amount);
    const bc = Number(t.balanceChange);
    if (t.label === "sale") { a.saleAmt += amt; a.saleNet += bc; }
    else if (t.label === "fee" || t.label === "commission") a.comision += Math.abs(amt);
    else if (t.label === "shipping") a.envio += Math.abs(amt);
    else if (t.label === "flex_cost" || t.label === "flex_bonificacion") a.flexNet += bc; // signed
  }

  // listing → display + per-unit product cost (COGS)
  interface ListingInfo { title: string; sku: string | null; imageUrl: string | null; unitCost: number; hasCost: boolean; dots: { color: string | null; label: string | null }[] }
  const listingMap = new Map<string, ListingInfo>();
  for (const l of listings) {
    let unitCost = 0;
    let hasCost = false;
    const dots: { color: string | null; label: string | null }[] = [];
    for (const it of l.pack?.items ?? []) {
      const c = Number(it.productVariant.product.unitCost);
      if (c > 0) hasCost = true;
      unitCost += it.quantity * c;
      dots.push({ color: it.productVariant.color, label: it.productVariant.variantLabel });
    }
    listingMap.set(l.mlItemId, {
      title: l.title ?? l.mlItemId,
      sku: l.pack?.sku ?? null,
      imageUrl: l.pack?.imageUrl ?? null,
      unitCost,
      hasCost,
      dots,
    });
  }

  const rows: OrderRow[] = [];
  const summary: OrderSummary = {
    count: 0, vendido: 0, comision: 0, envio: 0, costoProd: 0,
    devoluciones: 0, devolucionesCount: 0, envioExtra: 0, neto: 0, netoEntregados: 0,
  };

  for (const o of orders) {
    const key = o.mlOrderId.toString();
    const tx = txByOrder.get(key);
    const li = listingMap.get(o.mlItemId);
    const qty = o.quantity;
    const isReturned = RETURNED.has(o.shippingStatus);
    const isCancelled = o.shippingStatus === "CANCELLED";
    const prQty = o.partialRefundQty || 0;

    // Sale figures — prefer synced MP transactions; fall back to the order total.
    const hasTxData = !!tx && tx.saleAmt > 0;
    const vendido = hasTxData ? tx!.saleAmt : Number(o.totalAmount);
    const comision = hasTxData ? tx!.comision : 0;
    // Shipping cost the seller actually paid: shipping rows + net flex (flex_cost is a negative
    // balanceChange, so subtracting the signed flexNet adds the flex cost as a positive number).
    const envio = hasTxData ? tx!.envio - tx!.flexNet : 0;
    const envioExtra = Number(o.returnShipCost ?? 0);

    // COGS — lost only if the product does NOT come back. Fully returned orders are assumed restocked.
    const costoProd = li && !isReturned ? li.unitCost * qty : 0;

    // Net is computed straight from the displayed columns so each row foots exactly:
    //   neto = vendido − comisión − envío − costo prod − devolución − envío extra
    let devolucion = 0;
    if (isCancelled) {
      // Charged-then-cancelled: only the return freight (if any) is a real cost.
      devolucion = vendido; // shown as fully reversed
    } else if (isReturned) {
      // ML reverses the sale (and commission); we still eat the outbound (flex) + return freight.
      devolucion = vendido;
    } else if (prQty > 0 && qty > 0) {
      // Partial refund: ML emits no debit row → estimate the refunded NET pro-rata (matches reconciliation.ts).
      const saleNet = vendido - comision - envio;
      devolucion = (saleNet * Math.min(prQty, qty)) / qty;
    }
    const comisionEff = isReturned || isCancelled ? 0 : comision; // refunded on full reversal
    const neto = vendido - comisionEff - envio - costoProd - devolucion - envioExtra;

    const { estado, kind } = deriveEstado(o.shippingStatus, prQty);

    rows.push({
      id: o.id,
      mlOrderId: key,
      mlItemId: o.mlItemId,
      date: o.dateCreated.toISOString(),
      title: li?.title ?? o.mlItemId,
      sku: li?.sku ?? null,
      imageUrl: li?.imageUrl ?? null,
      variantDots: li?.dots ?? [],
      quantity: qty,
      shippingStatus: o.shippingStatus,
      logisticType: o.logisticType,
      buyerNickname: o.buyerNickname,
      estado,
      estadoKind: kind,
      vendido: r2(vendido),
      comision: r2(comisionEff),
      envio: r2(envio),
      costoProd: r2(costoProd),
      devolucion: r2(devolucion),
      envioExtra: r2(envioExtra),
      neto: r2(neto),
      hasTxData,
      hasCostData: !!li?.hasCost,
    });

    // summary
    if (!isCancelled) {
      summary.count++;
      summary.vendido += vendido;
      summary.comision += comisionEff;
      summary.envio += envio;
      summary.costoProd += costoProd;
      summary.envioExtra += envioExtra;
      summary.neto += neto;
      if (isReturned || prQty > 0) {
        summary.devoluciones += devolucion;
        summary.devolucionesCount++;
      } else {
        summary.netoEntregados += neto;
      }
    }
  }

  for (const k of ["vendido", "comision", "envio", "costoProd", "devoluciones", "envioExtra", "neto", "netoEntregados"] as const) {
    summary[k] = r2(summary[k]);
  }

  return { rows, summary };
}
