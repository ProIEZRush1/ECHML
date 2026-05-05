import { mlFetch, getMLCredentials } from "@/lib/ml/client";
import { prisma } from "@/lib/prisma";

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
          packId,
          dateCreated: new Date(order.date_closed || order.date_created),
        },
        update: {
          amount: order.total_amount,
          balanceChange: netReceived,
          status: order.status,
          description: item.item.title,
          packId,
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

      synced++;
    }

    offset += limit;
  }

  return { synced, total, fees: totalFees, shipping: totalShipping, revenue: totalRevenue };
}
