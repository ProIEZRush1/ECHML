export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { PrepStatus } from "@prisma/client";

const VALID_STATUSES: PrepStatus[] = ["NEW", "PREPARING", "READY", "SHIPPED"];

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { orderId, mlOrderId, prepStatus } = body as { orderId?: string; mlOrderId?: string; prepStatus: PrepStatus };

  if ((!orderId && !mlOrderId) || !VALID_STATUSES.includes(prepStatus)) {
    return NextResponse.json({ error: "Invalid orderId/mlOrderId or prepStatus" }, { status: 400 });
  }

  if (mlOrderId) {
    const result = await prisma.mLOrder.updateMany({
      where: { mlOrderId: BigInt(mlOrderId) },
      data: { prepStatus },
    });
    return NextResponse.json({ updated: result.count, mlOrderId, prepStatus });
  }

  const order = await prisma.mLOrder.update({
    where: { id: orderId },
    data: { prepStatus },
  });

  return NextResponse.json({ id: order.id, prepStatus: order.prepStatus });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { orderIds, prepStatus } = body as { orderIds: string[]; prepStatus: PrepStatus };

  if (!orderIds?.length || !VALID_STATUSES.includes(prepStatus)) {
    return NextResponse.json({ error: "Invalid orderIds or prepStatus" }, { status: 400 });
  }

  const result = await prisma.mLOrder.updateMany({
    where: { id: { in: orderIds } },
    data: { prepStatus },
  });

  return NextResponse.json({ updated: result.count });
}
