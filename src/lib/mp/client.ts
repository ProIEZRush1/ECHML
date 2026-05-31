import { mlFetch, getMLCredentials } from "@/lib/ml/client";
import { prisma } from "@/lib/prisma";
import type { ShippingStatus, PrepStatus } from "@prisma/client";

interface MLOrderPayment {
  id: number;
  transaction_amount: number;
  currency_id: string;
  status: string;
  marketplace_fee: number;
  shipping_cost: number;
  total_paid_amount: number;
}

interface MLOrderItem {
  item: { id: string; title: string };
  quantity: number;
  unit_price: number;
  sale_fee: number;
  currency_id: string;
}

interface MLOrderResult {
  id: number;
  status: string;
  date_created: string;
  date_closed: string;
  total_amount: number;
  currency_id: string;
  pack_id?: number | null;
  order_items: MLOrderItem[];
  payments: MLOrderPayment[];
  shipping: { id: number };
  tags: string[];
}

interface MLOrdersSearchResponse {
  results: MLOrderResult[];
  paging: { total: number; offset: number; limit: number };
}

export interface SyncResult {
  synced: number;
  total: number;
  fees: number;
  shipping: number;
  revenue: number;
}

export async function syncOrdersFromML(): Promise<SyncResult> {
  const cred = await getMLCredentials();
  if (!cred || !cred.mlUserId) {
    throw new Error("No hay credenciales de MercadoLibre configuradas.");
  }

  let offset = 0;
  const limit = 50;
  let total = Infinity;
  let synced = 0;
  let totalFees = 0;
  let totalShipping = 0;
  let totalRevenue = 0;

  while (offset < total) {
    const data = await mlFetch<MLOrdersSearchResponse>(`/orders/search`, {
      params: {
        seller: cred.mlUserId.toString(),
        "order.status": "paid",
        sort: "date_desc",
        offset: offset.toString(),
        limit: limit.toString(),
      },
    });

    total = data.paging.total;

    for (const order of data.results) {
      const payment = order.payments?.[0];
      const item = order.order_items?.[0];
      if (!item) continue;

      // sale_fee is the ML commission per item (from order_items)
      const saleFee = item.sale_fee ?? 0;
      // marketplace_fee from payment (sometimes includes other fees)
      const marketplaceFee = payment?.marketplace_fee ?? 0;
      // Use whichever is higher — sale_fee is more reliable for ML marketplace
      const commission = Math.max(saleFee, marketplaceFee);
      const shippingCost = payment?.shipping_cost ?? 0;
      const netReceived = order.total_amount - commission - shippingCost;

      totalFees += commission;
      totalShipping += shippingCost;
      totalRevenue += netReceived;

      let packId: string | null = null;
      const listing = await prisma.mLListing.findUnique({
        where: { mlItemId: item.item.id },
        select: { packId: true },
      });
      if (listing) packId = listing.packId;

      // Sale credit entry
      await prisma.mPTransaction.upsert({
        where: { mpId: BigInt(order.id) },
        create: {
          mpId: BigInt(order.id),
          type: "credit",
          amount: order.total_amount,
          balanceChange: netReceived,
          status: order.status,
          label: "sale",
          description: item.item.title,
          referenceId: String(order.id),
          mlOrderId: BigInt(order.id),
          mlPackId: order.pack_id ? BigInt(order.pack_id) : null,
          packId,
          quantity: item.quantity,
          dateCreated: new Date(order.date_closed || order.date_created),
        },
        update: {
          amount: order.total_amount,
          balanceChange: netReceived,
          status: order.status,
          description: item.item.title,
          packId,
          mlPackId: order.pack_id ? BigInt(order.pack_id) : null,
          quantity: item.quantity,
          syncedAt: new Date(),
        },
      });

      // Commission debit entry
      if (commission > 0) {
        const feeId = BigInt(order.id) * BigInt(100) + BigInt(1);
        await prisma.mPTransaction.upsert({
          where: { mpId: feeId },
          create: {
            mpId: feeId,
            type: "debit",
            amount: commission,
            balanceChange: -commission,
            status: "approved",
            label: "fee",
            description: `Comision ML - ${item.item.title}`,
            referenceId: String(order.id),
            mlOrderId: BigInt(order.id),
            packId,
            dateCreated: new Date(order.date_closed || order.date_created),
          },
          update: {
            amount: commission,
            balanceChange: -commission,
            description: `Comision ML - ${item.item.title}`,
            packId,
            syncedAt: new Date(),
          },
        });
      }

      // Shipping debit entry
      if (shippingCost > 0) {
        const shipId = BigInt(order.id) * BigInt(100) + BigInt(2);
        await prisma.mPTransaction.upsert({
          where: { mpId: shipId },
          create: {
            mpId: shipId,
            type: "debit",
            amount: shippingCost,
            balanceChange: -shippingCost,
            status: "approved",
            label: "shipping",
            description: `Envio - ${item.item.title}`,
            referenceId: String(order.id),
            mlOrderId: BigInt(order.id),
            packId,
            dateCreated: new Date(order.date_closed || order.date_created),
          },
          update: {
            amount: shippingCost,
            balanceChange: -shippingCost,
            description: `Envio - ${item.item.title}`,
            packId,
            syncedAt: new Date(),
          },
        });
      }

      // Store shipmentId on MLOrder (status sync happens separately via /api/orders/sync-status)
      if (order.shipping?.id) {
        await prisma.mLOrder.updateMany({
          where: { mlOrderId: BigInt(order.id) },
          data: { shipmentId: BigInt(order.shipping.id) },
        });
      }

      synced++;
    }

    offset += limit;
  }

  return { synced, total, fees: totalFees, shipping: totalShipping, revenue: totalRevenue };
}

export interface BackfillRangeResult {
  total: number;
  processed: number;
  ordersCreated: number;
  amountFixed: number;
  txUpserted: number;
}

function shipStatusFromTags(tags: string[] | undefined, status: string): { ship: ShippingStatus; prep: PrepStatus } {
  const t = new Set(tags || []);
  if (status === "cancelled") return { ship: "CANCELLED", prep: "NEW" };
  if (t.has("not_delivered")) return { ship: "NOT_DELIVERED", prep: "SHIPPED" };
  if (t.has("delivered")) return { ship: "DELIVERED", prep: "SHIPPED" };
  if (t.has("shipped")) return { ship: "SHIPPED", prep: "SHIPPED" };
  return { ship: "PENDING", prep: "NEW" };
}

/**
 * Range-scoped order backfill — the authoritative "match every sale to ML" pass.
 * Bounded by date so it always completes (unlike the unbounded syncOrdersFromML which
 * times out and leaves gaps). For each ML PAID order in [from,to]:
 *  - upserts MPTransaction sale/fee/shipping with the REAL paid amount (order.total_amount,
 *    not the listing price) → income matches ML exactly.
 *  - upserts MLOrder: creates the missing ones (status derived from tags so old delivered
 *    orders don't pollute Preparar), and fixes totalAmount on existing ones — WITHOUT
 *    touching prepStatus/shippingStatus (so return/prep state set elsewhere is preserved).
 */
export async function backfillOrdersRange(from: string, to: string): Promise<BackfillRangeResult> {
  const cred = await getMLCredentials();
  if (!cred?.mlUserId) throw new Error("No hay credenciales de MercadoLibre configuradas.");
  const fromISO = `${from}T00:00:00.000-06:00`;
  const toISO = `${to}T23:59:59.999-06:00`;

  let offset = 0;
  const limit = 50;
  let total = Infinity;
  let processed = 0, ordersCreated = 0, amountFixed = 0, txUpserted = 0;

  while (offset < total) {
    const data = await mlFetch<MLOrdersSearchResponse>(`/orders/search`, {
      params: {
        seller: cred.mlUserId.toString(),
        "order.status": "paid",
        "order.date_created.from": fromISO,
        "order.date_created.to": toISO,
        sort: "date_asc",
        offset: offset.toString(),
        limit: limit.toString(),
      },
    });
    total = data.paging.total;

    for (const order of data.results) {
      const item = order.order_items?.[0];
      if (!item) continue;
      const payment = order.payments?.[0];
      const commission = Math.max(item.sale_fee ?? 0, payment?.marketplace_fee ?? 0);
      const shippingCost = payment?.shipping_cost ?? 0;
      const netReceived = order.total_amount - commission - shippingCost;
      const when = new Date(order.date_closed || order.date_created);

      const listing = await prisma.mLListing.findUnique({ where: { mlItemId: item.item.id }, select: { packId: true } });
      const packId = listing?.packId ?? null;

      await prisma.mPTransaction.upsert({
        where: { mpId: BigInt(order.id) },
        create: {
          mpId: BigInt(order.id), type: "credit", amount: order.total_amount, balanceChange: netReceived,
          status: order.status, label: "sale", description: item.item.title, referenceId: String(order.id),
          mlOrderId: BigInt(order.id), mlPackId: order.pack_id ? BigInt(order.pack_id) : null, packId,
          quantity: item.quantity, dateCreated: when,
        },
        update: { amount: order.total_amount, balanceChange: netReceived, status: order.status, packId, mlPackId: order.pack_id ? BigInt(order.pack_id) : null, quantity: item.quantity, syncedAt: new Date() },
      });
      txUpserted++;

      if (commission > 0) {
        const feeId = BigInt(order.id) * BigInt(100) + BigInt(1);
        await prisma.mPTransaction.upsert({
          where: { mpId: feeId },
          create: { mpId: feeId, type: "debit", amount: commission, balanceChange: -commission, status: "approved", label: "fee", description: `Comision ML - ${item.item.title}`, referenceId: String(order.id), mlOrderId: BigInt(order.id), packId, dateCreated: when },
          update: { amount: commission, balanceChange: -commission, packId, syncedAt: new Date() },
        });
      }
      if (shippingCost > 0) {
        const shipId = BigInt(order.id) * BigInt(100) + BigInt(2);
        await prisma.mPTransaction.upsert({
          where: { mpId: shipId },
          create: { mpId: shipId, type: "debit", amount: shippingCost, balanceChange: -shippingCost, status: "approved", label: "shipping", description: `Envio - ${item.item.title}`, referenceId: String(order.id), mlOrderId: BigInt(order.id), packId, dateCreated: when },
          update: { amount: shippingCost, balanceChange: -shippingCost, packId, syncedAt: new Date() },
        });
      }

      // MLOrder: create missing (with real status), or fix amount on existing (never touch prep/ship state).
      const existing = await prisma.mLOrder.findUnique({ where: { mlOrderId: BigInt(order.id) }, select: { id: true, totalAmount: true } });
      if (!existing) {
        const { ship, prep } = shipStatusFromTags(order.tags, order.status);
        await prisma.mLOrder.create({
          data: {
            mlOrderId: BigInt(order.id), mlItemId: item.item.id, quantity: item.quantity,
            unitPrice: item.unit_price, totalAmount: order.total_amount, status: order.status,
            shippingStatus: ship, prepStatus: prep,
            shipmentId: order.shipping?.id ? BigInt(order.shipping.id) : null, dateCreated: when,
          },
        }).then(() => { ordersCreated++; }).catch(() => { /* unique race */ });
      } else if (Math.abs(Number(existing.totalAmount) - order.total_amount) > 0.5) {
        await prisma.mLOrder.update({ where: { id: existing.id }, data: { totalAmount: order.total_amount, unitPrice: item.unit_price, quantity: item.quantity } });
        amountFixed++;
      }
      processed++;
    }
    offset += limit;
  }

  return { total, processed, ordersCreated, amountFixed, txUpserted };
}
