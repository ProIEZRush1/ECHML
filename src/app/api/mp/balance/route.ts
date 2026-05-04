import { NextRequest, NextResponse } from "next/server";
import { verifyAnyAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const credits = await prisma.mPTransaction.aggregate({
      where: { type: "credit" },
      _sum: { balanceChange: true },
    });

    const debits = await prisma.mPTransaction.aggregate({
      where: { type: "debit" },
      _sum: { balanceChange: true },
    });

    const withdrawals = await prisma.withdrawal.aggregate({
      _sum: { amount: true },
    });

    const totalCredits = Number(credits._sum.balanceChange ?? 0);
    const totalDebits = Math.abs(Number(debits._sum.balanceChange ?? 0));
    const totalWithdrawn = Number(withdrawals._sum.amount ?? 0);

    return NextResponse.json({
      totalIncome: totalCredits,
      totalFees: totalDebits,
      totalWithdrawn,
      estimatedBalance: totalCredits - totalDebits - totalWithdrawn,
      lastSync: (await prisma.mPTransaction.findFirst({
        orderBy: { syncedAt: "desc" },
        select: { syncedAt: true },
      }))?.syncedAt ?? null,
    });
  } catch (error: unknown) {
    console.error("Error al obtener balance:", error);
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
