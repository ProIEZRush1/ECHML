export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mlFetch } from "@/lib/ml/client";
import { verifyAnyAuth } from "@/lib/api-auth";

const FLEX_COST = 115;

interface ShipmentCosts {
  senders: Array<{ cost: number; save: number; user_id: number }>;
}

export async function POST(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = (body as { action?: string }).action || "fix";
    const batchSize = (body as { batchSize?: number }).batchSize || 50;
    const offset = (body as { offset?: number }).offset || 0;

    // Action: cleanup — delete all wrong shipping/flex transactions
    if (action === "cleanup") {
      const [delShipping, delFlex, delBonif] = await Promise.all([
        prisma.mPTransaction.deleteMany({ where: { label: "shipping" } }),
        prisma.mPTransaction.deleteMany({ where: { label: "flex_cost" } }),
        prisma.mPTransaction.deleteMany({ where: { label: "flex_bonificacion" } }),
      ]);
      return NextResponse.json({
        message: `Cleanup: deleted ${delShipping.count} shipping, ${delFlex.count} flex_cost, ${delBonif.count} flex_bonificacion`,
        deleted: { shipping: delShipping.count, flex_cost: delFlex.count, flex_bonificacion: delBonif.count },
      });
    }

    // Action: fix — process orders in batches
    const sales = await prisma.mPTransaction.findMany({
      where: { label: "sale", mlOrderId: { not: null } },
      select: { mpId: true, mlOrderId: true, packId: true, description: true, dateCreated: true },
      orderBy: { dateCreated: "desc" },
      skip: offset,
      take: batchSize,
    });

    let addedShipping = 0;
    let addedFlexCost = 0;
    let addedFlexBonif = 0;
    const details: string[] = [];

    for (const sale of sales) {
      if (!sale.mlOrderId) continue;
      const orderId = sale.mlOrderId;

      try {
        const order = await mlFetch<{ shipping?: { id: number } }>(`/orders/${orderId}`);
        if (!order.shipping?.id) continue;

        const [shipment, shipCosts] = await Promise.all([
          mlFetch<{ logistic_type?: string }>(`/shipments/${order.shipping.id}`),
          mlFetch<ShipmentCosts>(`/shipments/${order.shipping.id}/costs`),
        ]);

        const isFlex = shipment.logistic_type === "self_service";
        const sender = shipCosts.senders?.[0];
        const txDate = sale.dateCreated;

        if (isFlex) {
          // Flex: $115 cost + bonificación credit
          const flexCostId = BigInt(orderId) * BigInt(100) + BigInt(3);
          const existing = await prisma.mPTransaction.findUnique({ where: { mpId: flexCostId } });
          if (!existing) {
            await prisma.mPTransaction.create({
              data: {
                mpId: flexCostId, type: "debit", amount: FLEX_COST,
                balanceChange: -FLEX_COST, status: "approved", label: "flex_cost",
                description: `Costo Flex $${FLEX_COST} - ${sale.description}`,
                referenceId: String(orderId), mlOrderId: orderId,
                packId: sale.packId, dateCreated: txDate,
              },
            });
            addedFlexCost++;
          }

          const bonificacion = sender?.save || 0;
          if (bonificacion > 0) {
            const bonifId = BigInt(orderId) * BigInt(100) + BigInt(4);
            const existingB = await prisma.mPTransaction.findUnique({ where: { mpId: bonifId } });
            if (!existingB) {
              await prisma.mPTransaction.create({
                data: {
                  mpId: bonifId, type: "credit", amount: bonificacion,
                  balanceChange: bonificacion, status: "approved", label: "flex_bonificacion",
                  description: `Bonificacion Flex $${bonificacion} - ${sale.description}`,
                  referenceId: String(orderId), mlOrderId: orderId,
                  packId: sale.packId, dateCreated: txDate,
                },
              });
              addedFlexBonif++;
            }
          }
          details.push(`${orderId}: Flex cost=$${FLEX_COST} bonif=$${bonificacion}`);
        } else {
          // Non-Flex: shipping = senders[0].cost
          const sellerShipping = sender?.cost || 0;
          if (sellerShipping > 0) {
            const shipId = BigInt(orderId) * BigInt(100) + BigInt(2);
            const existing = await prisma.mPTransaction.findUnique({ where: { mpId: shipId } });
            if (!existing) {
              await prisma.mPTransaction.create({
                data: {
                  mpId: shipId, type: "debit", amount: sellerShipping,
                  balanceChange: -sellerShipping, status: "approved", label: "shipping",
                  description: `Envio $${sellerShipping} - ${sale.description}`,
                  referenceId: String(orderId), mlOrderId: orderId,
                  packId: sale.packId, dateCreated: txDate,
                },
              });
              addedShipping++;
              details.push(`${orderId}: shipping $${sellerShipping} (${shipment.logistic_type})`);
            }
          }
        }
      } catch (err) {
        details.push(`${orderId}: ERROR ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const totalSales = await prisma.mPTransaction.count({ where: { label: "sale", mlOrderId: { not: null } } });

    return NextResponse.json({
      message: `Batch ${offset}-${offset + sales.length}: ${addedShipping} shipping, ${addedFlexCost} flex_cost, ${addedFlexBonif} bonif`,
      addedShipping, addedFlexCost, addedFlexBonif,
      processed: sales.length, totalSales,
      nextOffset: offset + sales.length < totalSales ? offset + sales.length : null,
      details,
    });
  } catch (error: unknown) {
    console.error("Fix shipping error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
