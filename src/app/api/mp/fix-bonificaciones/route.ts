export const dynamic = "force-dynamic";
export const maxDuration = 120;

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mlFetch } from "@/lib/ml/client";
import { verifyAnyAuth } from "@/lib/api-auth";

interface ShipmentCosts {
  senders?: Array<{ cost?: number; save?: number }>;
}

const FLEX_COST = 115;

export async function POST(request: Request) {
  const user = await verifyAnyAuth(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const flexOrders = await prisma.mLOrder.findMany({
    where: { logisticType: "self_service", shipmentId: { not: null } },
    select: { mlOrderId: true, shipmentId: true, mlItemId: true },
    orderBy: { dateCreated: "desc" },
    take: 200,
  });

  let created = 0;
  let skipped = 0;

  for (const order of flexOrders) {
    const flexCostId = order.mlOrderId * BigInt(100) + BigInt(3);
    const bonifId = order.mlOrderId * BigInt(100) + BigInt(4);

    const existing = await prisma.mPTransaction.findUnique({ where: { mpId: bonifId } });
    if (existing) { skipped++; continue; }

    try {
      const shipCosts = await mlFetch<ShipmentCosts>(`/shipments/${order.shipmentId}/costs`);
      const sender = shipCosts.senders?.[0];
      const bonificacion = sender?.save || 0;

      const saleTx = await prisma.mPTransaction.findFirst({
        where: { mlOrderId: order.mlOrderId, label: "sale" },
        select: { packId: true, mlPackId: true, dateCreated: true, description: true },
      });

      const packId = saleTx?.packId || null;
      const mlPack = saleTx?.mlPackId || null;
      const txDate = saleTx?.dateCreated || new Date();
      const title = saleTx?.description?.replace("Pack 3 Playeras", "Pack 3 Playeras") || order.mlItemId;

      await prisma.mPTransaction.upsert({
        where: { mpId: flexCostId },
        create: {
          mpId: flexCostId, type: "debit", amount: FLEX_COST,
          balanceChange: -FLEX_COST, status: "approved", label: "flex_cost",
          description: `Costo Flex $${FLEX_COST} - ${title}`,
          referenceId: String(order.mlOrderId), mlOrderId: order.mlOrderId, mlPackId: mlPack,
          packId, dateCreated: txDate,
        },
        update: {},
      });

      if (bonificacion > 0) {
        await prisma.mPTransaction.upsert({
          where: { mpId: bonifId },
          create: {
            mpId: bonifId, type: "credit", amount: bonificacion,
            balanceChange: bonificacion, status: "approved", label: "flex_bonificacion",
            description: `Bonificacion Flex - ${title}`,
            referenceId: String(order.mlOrderId), mlOrderId: order.mlOrderId, mlPackId: mlPack,
            packId, dateCreated: txDate,
          },
          update: {},
        });
      }

      created++;
    } catch {
      // skip individual failures
    }
  }

  return NextResponse.json({ total: flexOrders.length, created, skipped });
}
