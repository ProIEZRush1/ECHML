import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAnyAuth } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const { dateFrom, dateTo } = body as { dateFrom?: string; dateTo?: string };

  const where: Record<string, unknown> = {
    label: "flex_cost",
    paidAt: null,
  };

  if (dateFrom || dateTo) {
    where.dateCreated = {};
    if (dateFrom) (where.dateCreated as Record<string, Date>).gte = new Date(`${dateFrom}T00:00:00.000Z`);
    if (dateTo) (where.dateCreated as Record<string, Date>).lte = new Date(`${dateTo}T23:59:59.999Z`);
  }

  const result = await prisma.mPTransaction.updateMany({
    where,
    data: { paidAt: new Date() },
  });

  return NextResponse.json({ marked: result.count });
}
