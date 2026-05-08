export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mlFetch } from "@/lib/ml/client";

interface MLOrderResponse {
  id: number;
  order_items: Array<{
    item: { id: string; title: string };
    quantity: number;
    unit_price: number;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const batchSize = 50;

    const saleTxs = await prisma.mPTransaction.findMany({
      where: {
        label: "sale",
        mlOrderId: { not: null },
      },
      select: {
        id: true,
        mlOrderId: true,
        quantity: true,
      },
      orderBy: { dateCreated: "desc" },
      skip: offset,
      take: batchSize,
    });

    if (saleTxs.length === 0) {
      return NextResponse.json({ updated: 0, message: "No more transactions to process" });
    }

    let updated = 0;

    for (const tx of saleTxs) {
      if (!tx.mlOrderId) continue;

      try {
        const order = await mlFetch<MLOrderResponse>(`/orders/${tx.mlOrderId.toString()}`);
        const quantity = order.order_items?.[0]?.quantity ?? 1;

        if (quantity !== tx.quantity) {
          await prisma.mPTransaction.update({
            where: { id: tx.id },
            data: { quantity },
          });
          updated++;
        }
      } catch (err) {
        console.error(`Failed to fetch order ${tx.mlOrderId}:`, err);
      }
    }

    return NextResponse.json({
      updated,
      processed: saleTxs.length,
      nextOffset: offset + batchSize,
    });
  } catch (error) {
    console.error("fix-quantity error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
