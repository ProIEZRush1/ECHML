export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mlFetch } from "@/lib/ml/client";
import { verifyAnyAuth } from "@/lib/api-auth";

const FLEX_COST = 115;

interface MLShipment {
  id: number;
  logistic_type?: string;
  status?: string;
}

export async function POST(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const sales = await prisma.mPTransaction.findMany({
      where: { label: "sale" },
      select: { id: true, mpId: true, mlOrderId: true, packId: true, description: true, dateCreated: true },
    });

    let fixedShipping = 0;
    let fixedFlex = 0;
    let removedFlex = 0;
    const details: string[] = [];

    for (const sale of sales) {
      if (!sale.mlOrderId) continue;
      const orderId = sale.mlOrderId;

      try {
        const order = await mlFetch<{
          id: number;
          shipping: { id: number };
          payments: Array<{ shipping_cost: number; marketplace_fee: number }>;
          order_items: Array<{ item: { id: string; title: string }; sale_fee: number }>;
        }>(`/orders/${orderId}`);

        const payment = order.payments?.[0];
        const shippingCost = payment?.shipping_cost ?? 0;
        const item = order.order_items?.[0];

        // Fix shipping transaction
        const shipId = BigInt(orderId) * BigInt(100) + BigInt(2);
        if (shippingCost > 0) {
          const existing = await prisma.mPTransaction.findUnique({ where: { mpId: shipId } });
          if (!existing || Number(existing.amount) !== shippingCost) {
            await prisma.mPTransaction.upsert({
              where: { mpId: shipId },
              create: {
                mpId: shipId, type: "debit", amount: shippingCost,
                balanceChange: -shippingCost, status: "approved", label: "shipping",
                description: `Envio - ${item?.item.title || sale.description}`,
                referenceId: String(orderId), mlOrderId: orderId,
                packId: sale.packId, dateCreated: sale.dateCreated,
              },
              update: { amount: shippingCost, balanceChange: -shippingCost, packId: sale.packId, syncedAt: new Date() },
            });
            fixedShipping++;
            details.push(`Order ${orderId}: shipping set to $${shippingCost}`);
          }
        }

        // Check shipment for Flex
        const flexCostId = BigInt(orderId) * BigInt(100) + BigInt(3);
        if (order.shipping?.id) {
          const shipment = await mlFetch<MLShipment>(`/shipments/${order.shipping.id}`);
          const isFlex = shipment.logistic_type === "xd_drop_off";

          if (isFlex) {
            await prisma.mPTransaction.upsert({
              where: { mpId: flexCostId },
              create: {
                mpId: flexCostId, type: "debit", amount: FLEX_COST,
                balanceChange: -FLEX_COST, status: "approved", label: "flex_cost",
                description: `Costo Flex $${FLEX_COST} - ${item?.item.title || sale.description}`,
                referenceId: String(orderId), mlOrderId: orderId,
                packId: sale.packId, dateCreated: sale.dateCreated,
              },
              update: { amount: FLEX_COST, balanceChange: -FLEX_COST, packId: sale.packId, syncedAt: new Date() },
            });
            fixedFlex++;
            details.push(`Order ${orderId}: confirmed Flex (${shipment.logistic_type})`);
          } else {
            // NOT Flex — delete any incorrect flex_cost transaction
            const existing = await prisma.mPTransaction.findUnique({ where: { mpId: flexCostId } });
            if (existing) {
              await prisma.mPTransaction.delete({ where: { mpId: flexCostId } });
              removedFlex++;
              details.push(`Order ${orderId}: removed wrong flex_cost (logistic_type: ${shipment.logistic_type})`);
            }
          }
        } else {
          // No shipping ID — remove any flex_cost
          const existing = await prisma.mPTransaction.findUnique({ where: { mpId: flexCostId } });
          if (existing) {
            await prisma.mPTransaction.delete({ where: { mpId: flexCostId } });
            removedFlex++;
            details.push(`Order ${orderId}: removed flex_cost (no shipping ID)`);
          }
        }
      } catch (err) {
        details.push(`Order ${orderId}: ERROR - ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return NextResponse.json({
      message: `Fixed ${fixedShipping} shipping, ${fixedFlex} flex confirmed, ${removedFlex} wrong flex removed`,
      fixedShipping,
      fixedFlex,
      removedFlex,
      totalOrders: sales.length,
      details,
    });
  } catch (error: unknown) {
    console.error("Fix shipping error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
