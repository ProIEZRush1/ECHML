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

interface MPPaymentDetail {
  id: number;
  status: string;
  transaction_amount: number;
  net_received_amount?: number;
  total_paid_amount?: number;
  fee_details?: Array<{ type: string; amount: number; fee_payer: string }>;
  transaction_details?: {
    net_received_amount?: number;
    total_paid_amount?: number;
  };
  money_release_date?: string;
  operation_type?: string;
  description?: string;
  collector_id?: number;
}

export interface SyncResult {
  synced: number;
  total: number;
  fees: number;
  revenue: number;
}

async function getPaymentDetail(paymentId: number): Promise<MPPaymentDetail | null> {
  try {
    return await mlFetch<MPPaymentDetail>(`/v1/payments/${paymentId}`);
  } catch {
    return null;
  }
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

      let marketplaceFee = payment?.marketplace_fee ?? 0;
      let shippingCost = payment?.shipping_cost ?? 0;
      let netReceived = 0;

      if (payment?.id) {
        const detail = await getPaymentDetail(payment.id);
        if (detail) {
          if (detail.fee_details?.length) {
            marketplaceFee = detail.fee_details.reduce((sum, f) => sum + f.amount, 0);
          }
          const netFromDetails = detail.transaction_details?.net_received_amount
            ?? detail.net_received_amount;
          if (netFromDetails && netFromDetails > 0) {
            netReceived = netFromDetails;
          }
        }
      }

      if (netReceived === 0) {
        netReceived = order.total_amount - marketplaceFee - shippingCost;
      }

      totalFees += marketplaceFee;
      totalRevenue += netReceived;

      let packId: string | null = null;
      const listing = await prisma.mLListing.findUnique({
        where: { mlItemId: item.item.id },
        select: { packId: true },
      });
      if (listing) packId = listing.packId;

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

      if (marketplaceFee > 0) {
        const feeId = BigInt(order.id) * BigInt(100) + BigInt(1);
        await prisma.mPTransaction.upsert({
          where: { mpId: feeId },
          create: {
            mpId: feeId,
            type: "debit",
            amount: marketplaceFee,
            balanceChange: -marketplaceFee,
            status: "approved",
            label: "fee",
            description: `Comision ML - ${item.item.title}`,
            referenceId: String(order.id),
            mlOrderId: BigInt(order.id),
            packId,
            dateCreated: new Date(order.date_closed || order.date_created),
          },
          update: {
            amount: marketplaceFee,
            balanceChange: -marketplaceFee,
            description: `Comision ML - ${item.item.title}`,
            syncedAt: new Date(),
          },
        });
      }

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
            syncedAt: new Date(),
          },
        });
      }

      synced++;
    }

    offset += limit;
  }

  return { synced, total, fees: totalFees, revenue: totalRevenue };
}

export async function getBillingSummary() {
  try {
    const data = await mlFetch<{ results: Array<{ key: string }> }>(
      "/billing/integration/monthly/periods",
      { params: { group: "MP", document_type: "BILL", limit: "1" } }
    );
    if (!data.results?.length) return null;
    const key = data.results[0].key;
    return await mlFetch(`/billing/integration/periods/key/${key}/summary/details`);
  } catch {
    return null;
  }
}
