export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mlFetch } from "@/lib/ml/client";
import { processSale } from "@/lib/stock/engine";

interface MLWebhookBody {
  _id: string;
  resource: string;
  user_id: number;
  topic: string;
  application_id: number;
  attempts: number;
  sent: string;
  received: string;
}

interface MLOrder {
  id: number;
  status: string;
  total_amount: number;
  date_created: string;
  date_closed: string;
  pack_id?: number | null;
  order_items: Array<{
    item: { id: string; title: string };
    quantity: number;
    unit_price: number;
    sale_fee: number;
  }>;
  payments: Array<{
    id: number;
    shipping_cost: number;
    marketplace_fee: number;
  }>;
  shipping?: { id: number };
}

interface ShipmentCosts {
  senders: Array<{
    cost: number;
    save: number;
    user_id: number;
  }>;
}

const FLEX_COST = 115;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MLWebhookBody;

    await prisma.webhookLog.create({
      data: {
        topic: body.topic,
        resource: body.resource,
        mlUserId: BigInt(body.user_id),
        payload: JSON.parse(JSON.stringify(body)),
      },
    });

    if (body.topic === "orders_v2") {
      const orderId = body.resource.replace("/orders/", "");

      try {
        const order = await mlFetch<MLOrder>(`/orders/${orderId}`);

        if (order.status === "paid") {
          const item = order.order_items?.[0];
          if (item) {
            try {
              await processSale(BigInt(order.id), item.item.id, item.quantity);
            } catch (err) {
              console.error(`processSale failed for order ${order.id}:`, err);
            }

            const payment = order.payments?.[0];
            const saleFee = item.sale_fee ?? 0;
            const marketplaceFee = payment?.marketplace_fee ?? 0;
            const commission = Math.max(saleFee, marketplaceFee);
            const paymentShippingCost = payment?.shipping_cost ?? 0;
            const netReceived = order.total_amount - commission - paymentShippingCost;

            let packId: string | null = null;
            const listing = await prisma.mLListing.findUnique({
              where: { mlItemId: item.item.id },
              select: { packId: true },
            });
            if (listing) packId = listing.packId;

            const txDate = new Date(order.date_closed || order.date_created);
            const mlPack = order.pack_id ? BigInt(order.pack_id) : null;

            // Sale credit
            await prisma.mPTransaction.upsert({
              where: { mpId: BigInt(order.id) },
              create: {
                mpId: BigInt(order.id), type: "credit", amount: order.total_amount,
                balanceChange: netReceived, status: order.status, label: "sale",
                description: item.item.title, referenceId: String(order.id),
                mlOrderId: BigInt(order.id), mlPackId: mlPack,
                packId, quantity: item.quantity, dateCreated: txDate,
              },
              update: {
                amount: order.total_amount, balanceChange: netReceived,
                status: order.status, description: item.item.title, packId,
                mlPackId: mlPack,
                quantity: item.quantity, syncedAt: new Date(),
              },
            });

            // Commission debit
            if (commission > 0) {
              const feeId = BigInt(order.id) * BigInt(100) + BigInt(1);
              await prisma.mPTransaction.upsert({
                where: { mpId: feeId },
                create: {
                  mpId: feeId, type: "debit", amount: commission,
                  balanceChange: -commission, status: "approved", label: "fee",
                  description: `Comision ML - ${item.item.title}`,
                  referenceId: String(order.id), mlOrderId: BigInt(order.id), mlPackId: mlPack,
                  packId, dateCreated: txDate,
                },
                update: { amount: commission, balanceChange: -commission, packId, mlPackId: mlPack, syncedAt: new Date() },
              });
            }

            // Fetch shipment for real shipping cost and Flex detection
            if (order.shipping?.id) {
              try {
                const [shipment, shipCosts] = await Promise.all([
                  mlFetch<{ logistic_type?: string }>(`/shipments/${order.shipping.id}`),
                  mlFetch<ShipmentCosts>(`/shipments/${order.shipping.id}/costs`),
                ]);

                const isFlex = shipment.logistic_type === "self_service";
                const sender = shipCosts.senders?.[0];

                if (isFlex) {
                  // Flex: $115 internal cost + bonificación credit from ML
                  const flexCostId = BigInt(order.id) * BigInt(100) + BigInt(3);
                  await prisma.mPTransaction.upsert({
                    where: { mpId: flexCostId },
                    create: {
                      mpId: flexCostId, type: "debit", amount: FLEX_COST,
                      balanceChange: -FLEX_COST, status: "approved", label: "flex_cost",
                      description: `Costo Flex $${FLEX_COST} - ${item.item.title}`,
                      referenceId: String(order.id), mlOrderId: BigInt(order.id), mlPackId: mlPack,
                      packId, dateCreated: txDate,
                    },
                    update: { amount: FLEX_COST, balanceChange: -FLEX_COST, packId, mlPackId: mlPack, syncedAt: new Date() },
                  });

                  const bonificacion = sender?.save || 0;
                  if (bonificacion > 0) {
                    const bonifId = BigInt(order.id) * BigInt(100) + BigInt(4);
                    await prisma.mPTransaction.upsert({
                      where: { mpId: bonifId },
                      create: {
                        mpId: bonifId, type: "credit", amount: bonificacion,
                        balanceChange: bonificacion, status: "approved", label: "flex_bonificacion",
                        description: `Bonificacion Flex - ${item.item.title}`,
                        referenceId: String(order.id), mlOrderId: BigInt(order.id), mlPackId: mlPack,
                        packId, dateCreated: txDate,
                      },
                      update: { amount: bonificacion, balanceChange: bonificacion, packId, mlPackId: mlPack, syncedAt: new Date() },
                    });
                  }
                } else {
                  // Non-Flex: real shipping cost from senders[0].cost
                  const sellerShipping = sender?.cost || 0;
                  if (sellerShipping > 0) {
                    const shipId = BigInt(order.id) * BigInt(100) + BigInt(2);
                    await prisma.mPTransaction.upsert({
                      where: { mpId: shipId },
                      create: {
                        mpId: shipId, type: "debit", amount: sellerShipping,
                        balanceChange: -sellerShipping, status: "approved", label: "shipping",
                        description: `Envio - ${item.item.title}`,
                        referenceId: String(order.id), mlOrderId: BigInt(order.id), mlPackId: mlPack,
                        packId, dateCreated: txDate,
                      },
                      update: { amount: sellerShipping, balanceChange: -sellerShipping, packId, mlPackId: mlPack, syncedAt: new Date() },
                    });
                  }
                }
              } catch (shipErr) {
                console.error(`Shipment check failed for order ${order.id}:`, shipErr);
              }
            }
          }
        }
      } catch (err) {
        console.error(`Failed to process order webhook ${orderId}:`, err);
        await prisma.webhookLog.updateMany({
          where: { resource: body.resource },
          data: { error: String(err), processedAt: new Date() },
        });
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ status: "ok" });
  }
}
