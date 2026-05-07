export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mlFetch } from "@/lib/ml/client";
import { verifyAnyAuth } from "@/lib/api-auth";

const FLEX_COST = 115;

export async function POST(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const batchSize = (body as { batchSize?: number }).batchSize || 50;
    const offset = (body as { offset?: number }).offset || 0;

    const sales = await prisma.mPTransaction.findMany({
      where: { label: "sale", mlOrderId: { not: null } },
      select: { mpId: true, mlOrderId: true, packId: true, description: true, dateCreated: true },
      orderBy: { dateCreated: "desc" },
      skip: offset,
      take: batchSize,
    });

    let fixedShipping = 0;
    let addedFlex = 0;
    let removedFlex = 0;
    const details: string[] = [];

    for (const sale of sales) {
      if (!sale.mlOrderId) continue;
      const orderId = sale.mlOrderId;

      try {
        const order = await mlFetch<{ shipping?: { id: number } }>(`/orders/${orderId}`);
        if (!order.shipping?.id) continue;

        const shipment = await mlFetch<{ logistic_type?: string; base_cost?: number }>(`/shipments/${order.shipping.id}`);

        // Fix shipping from base_cost
        const shipId = BigInt(orderId) * BigInt(100) + BigInt(2);
        if (shipment.base_cost && shipment.base_cost > 0) {
          const existing = await prisma.mPTransaction.findUnique({ where: { mpId: shipId } });
          if (!existing) {
            await prisma.mPTransaction.create({
              data: {
                mpId: shipId, type: "debit", amount: shipment.base_cost,
                balanceChange: -shipment.base_cost, status: "approved", label: "shipping",
                description: `Envio - ${sale.description}`,
                referenceId: String(orderId), mlOrderId: orderId,
                packId: sale.packId, dateCreated: sale.dateCreated,
              },
            });
            fixedShipping++;
            details.push(`${orderId}: shipping $${shipment.base_cost} (${shipment.logistic_type})`);
          }
        }

        // Flex detection: self_service
        const flexCostId = BigInt(orderId) * BigInt(100) + BigInt(3);
        if (shipment.logistic_type === "self_service") {
          const existing = await prisma.mPTransaction.findUnique({ where: { mpId: flexCostId } });
          if (!existing) {
            await prisma.mPTransaction.create({
              data: {
                mpId: flexCostId, type: "debit", amount: FLEX_COST,
                balanceChange: -FLEX_COST, status: "approved", label: "flex_cost",
                description: `Costo Flex $${FLEX_COST} - ${sale.description}`,
                referenceId: String(orderId), mlOrderId: orderId,
                packId: sale.packId, dateCreated: sale.dateCreated,
              },
            });
            addedFlex++;
            details.push(`${orderId}: Flex detected (self_service)`);
          }
        } else {
          const existing = await prisma.mPTransaction.findUnique({ where: { mpId: flexCostId } });
          if (existing) {
            await prisma.mPTransaction.delete({ where: { mpId: flexCostId } });
            removedFlex++;
            details.push(`${orderId}: removed wrong flex (${shipment.logistic_type})`);
          }
        }
      } catch (err) {
        details.push(`${orderId}: ERROR ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const totalSales = await prisma.mPTransaction.count({ where: { label: "sale", mlOrderId: { not: null } } });

    return NextResponse.json({
      message: `Batch ${offset}-${offset + sales.length}: ${fixedShipping} shipping fixed, ${addedFlex} flex added, ${removedFlex} wrong flex removed`,
      fixedShipping,
      addedFlex,
      removedFlex,
      processed: sales.length,
      totalSales,
      nextOffset: offset + sales.length < totalSales ? offset + sales.length : null,
      details,
    });
  } catch (error: unknown) {
    console.error("Fix shipping error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
