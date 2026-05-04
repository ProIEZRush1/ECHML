import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAnyAuth } from "@/lib/api-auth";
import { Decimal } from "@prisma/client/runtime/library";

export const dynamic = "force-dynamic";

interface PackIncome {
  packId: string;
  packSku: string;
  packName: string;
  income: number;
  withdrawn: number;
  balance: number;
}

interface RecentTransaction {
  type: "income" | "withdrawal" | "expense";
  date: string;
  amount: number;
  description: string;
}

function decimalToNumber(val: Decimal | number): number {
  if (val instanceof Decimal) {
    return val.toNumber();
  }
  return Number(val);
}

export async function GET(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  try {
    const [orders, withdrawals, expenses, listings, allocations] = await Promise.all([
      prisma.mLOrder.findMany({
        select: {
          mlItemId: true,
          totalAmount: true,
          dateCreated: true,
          mlOrderId: true,
        },
      }),
      prisma.withdrawal.findMany({
        include: {
          allocations: true,
        },
        orderBy: { date: "desc" },
      }),
      prisma.expense.findMany({
        orderBy: { date: "desc" },
      }),
      prisma.mLListing.findMany({
        select: {
          mlItemId: true,
          packId: true,
          pack: { select: { id: true, sku: true, name: true } },
        },
      }),
      prisma.withdrawalAllocation.findMany({
        select: {
          packId: true,
          productId: true,
          amount: true,
        },
      }),
    ]);

    // Build mlItemId -> Pack mapping
    const itemToPackMap = new Map<string, { id: string; sku: string; name: string }>();
    for (const listing of listings) {
      itemToPackMap.set(listing.mlItemId, listing.pack);
    }

    // Calculate income per pack
    const incomeByPack = new Map<string, number>();
    let totalIncome = 0;

    for (const order of orders) {
      const amount = decimalToNumber(order.totalAmount);
      totalIncome += amount;

      const pack = itemToPackMap.get(order.mlItemId);
      if (pack) {
        incomeByPack.set(pack.id, (incomeByPack.get(pack.id) || 0) + amount);
      }
    }

    // Calculate withdrawals per pack
    const withdrawnByPack = new Map<string, number>();
    let totalAllocated = 0;

    for (const alloc of allocations) {
      const amount = decimalToNumber(alloc.amount);
      if (alloc.packId) {
        withdrawnByPack.set(alloc.packId, (withdrawnByPack.get(alloc.packId) || 0) + amount);
        totalAllocated += amount;
      }
    }

    // Total withdrawn and expenses
    const totalWithdrawn = withdrawals.reduce(
      (sum, w) => sum + decimalToNumber(w.amount),
      0
    );
    const totalExpenses = expenses.reduce(
      (sum, e) => sum + decimalToNumber(e.amount),
      0
    );

    const unallocatedWithdrawals = totalWithdrawn - totalAllocated;
    const mpBalance = totalIncome - totalWithdrawn;

    // Build byPack array
    const packIds = new Set<string>();
    for (const [packId] of incomeByPack) packIds.add(packId);
    for (const [packId] of withdrawnByPack) packIds.add(packId);

    const byPack: PackIncome[] = [];
    for (const listing of listings) {
      if (!packIds.has(listing.pack.id)) continue;
      if (byPack.some((p) => p.packId === listing.pack.id)) continue;

      const income = incomeByPack.get(listing.pack.id) || 0;
      const withdrawn = withdrawnByPack.get(listing.pack.id) || 0;

      byPack.push({
        packId: listing.pack.id,
        packSku: listing.pack.sku,
        packName: listing.pack.name,
        income: Math.round(income * 100) / 100,
        withdrawn: Math.round(withdrawn * 100) / 100,
        balance: Math.round((income - withdrawn) * 100) / 100,
      });
    }

    byPack.sort((a, b) => b.income - a.income);

    // Build recent transactions (last 20 mixed)
    const recentTransactions: RecentTransaction[] = [];

    for (const order of orders) {
      recentTransactions.push({
        type: "income",
        date: order.dateCreated.toISOString(),
        amount: decimalToNumber(order.totalAmount),
        description: `Venta ${order.mlItemId}`,
      });
    }

    for (const withdrawal of withdrawals) {
      recentTransactions.push({
        type: "withdrawal",
        date: withdrawal.date.toISOString(),
        amount: -decimalToNumber(withdrawal.amount),
        description: withdrawal.concept,
      });
    }

    for (const expense of expenses) {
      recentTransactions.push({
        type: "expense",
        date: expense.date.toISOString(),
        amount: -decimalToNumber(expense.amount),
        description: `[${expense.category}] ${expense.concept}`,
      });
    }

    recentTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const last20 = recentTransactions.slice(0, 20);

    return NextResponse.json({
      summary: {
        totalIncome: Math.round(totalIncome * 100) / 100,
        totalWithdrawn: Math.round(totalWithdrawn * 100) / 100,
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        mpBalance: Math.round(mpBalance * 100) / 100,
        unallocatedWithdrawals: Math.round(unallocatedWithdrawals * 100) / 100,
      },
      byPack,
      recentTransactions: last20,
    });
  } catch (error: unknown) {
    console.error("Error al calcular flujo de caja:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
