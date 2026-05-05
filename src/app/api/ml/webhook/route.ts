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
  order_items: Array<{
    item: { id: string; title: string };
    quantity: number;
    unit_price: number;
  }>;
}

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
          for (const item of order.order_items) {
            try {
              await processSale(
                BigInt(order.id),
                item.item.id,
                item.quantity
              );
            } catch (err) {
              console.error(`processSale failed for order ${order.id} item ${item.item.id}:`, err);
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
