import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAnyAuth } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const { amount, dateFrom, dateTo } = body as { amount: number; dateFrom?: string; dateTo?: string };

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "Monto invalido" }, { status: 400 });
  }

  const mpAccount = await prisma.account.findFirst({ where: { name: "Mercado Pago" } });

  const dateFilter: Record<string, Date> = {};
  if (dateFrom) dateFilter.gte = new Date(`${dateFrom}T00:00:00.000Z`);
  if (dateTo) dateFilter.lte = new Date(`${dateTo}T23:59:59.999Z`);

  const unpaidFlex = await prisma.mPTransaction.findMany({
    where: {
      label: "flex_cost",
      paidAt: null,
      ...(Object.keys(dateFilter).length > 0 ? { dateCreated: dateFilter } : {}),
    },
    orderBy: { dateCreated: "asc" },
    select: { id: true, amount: true },
  });

  let remaining = amount;
  const toMark: string[] = [];
  for (const tx of unpaidFlex) {
    if (remaining <= 0) break;
    toMark.push(tx.id);
    remaining -= Math.abs(Number(tx.amount));
  }

  if (toMark.length > 0) {
    await prisma.mPTransaction.updateMany({
      where: { id: { in: toMark } },
      data: { paidAt: new Date() },
    });
  }

  await prisma.expense.create({
    data: {
      concept: `Pago envios Flex (${toMark.length} envios)`,
      amount,
      date: new Date(),
      category: "envios",
      type: "registro",
      userId: session.id,
      ...(mpAccount ? { accountId: mpAccount.id } : {}),
    },
  });

  return NextResponse.json({ marked: toMark.length, expenseCreated: true });
}
