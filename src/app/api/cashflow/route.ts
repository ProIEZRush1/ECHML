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
  fees: number;
  netIncome: number;
  withdrawn: number;
  balance: number;
}

interface RecentTransaction {
  type: "income" | "withdrawal" | "expense" | "fee" | "mp_movement";
  date: string;
  amount: number;
  description: string;
  label?: string;
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
    const [orders, withdrawals, expenses, listings, allocations, mpTransactions] =
      await Promise.all([
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
        prisma.mPTransaction.findMany({
          orderBy: { dateCreated: "desc" },
        }),
      ]);

    const hasMPData = mpTransactions.length > 0;

    // Build mlItemId -> Pack mapping
    const itemToPackMap = new Map<string, { id: string; sku: string; name: string }>();
    for (const listing of listings) {
      itemToPackMap.set(listing.mlItemId, listing.pack);
    }

    // Calculate income per pack — use MP transactions if available, else fallback to MLOrder
    const incomeByPack = new Map<string, number>();
    const feesByPack = new Map<string, number>();
    let totalIncome = 0;
    let totalFees = 0;
    let totalShippingFees = 0;

    if (hasMPData) {
      // Use MP transaction data for more accurate income (net of fees)
      for (const tx of mpTransactions) {
        const amount = decimalToNumber(tx.amount);
        const label = tx.label;

        if (label === "sale" || (tx.type === "credit" && label !== "refund")) {
          if (label === "sale") {
            totalIncome += amount;
            if (tx.packId) {
              incomeByPack.set(tx.packId, (incomeByPack.get(tx.packId) || 0) + amount);
            }
          }
        }

        if (label === "fee" || label === "commission") {
          totalFees += Math.abs(amount);
          if (tx.packId) {
            feesByPack.set(tx.packId, (feesByPack.get(tx.packId) || 0) + Math.abs(amount));
          }
        }

        if (label === "shipping") {
          totalShippingFees += Math.abs(amount);
        }
      }
    } else {
      // Fallback: use MLOrder data
      for (const order of orders) {
        const amount = decimalToNumber(order.totalAmount);
        totalIncome += amount;

        const pack = itemToPackMap.get(order.mlItemId);
        if (pack) {
          incomeByPack.set(pack.id, (incomeByPack.get(pack.id) || 0) + amount);
        }
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
    const mpBalance = totalIncome - totalWithdrawn - totalFees - totalShippingFees;

    // Build byPack array
    const packIds = new Set<string>();
    for (const [packId] of incomeByPack) packIds.add(packId);
    for (const [packId] of withdrawnByPack) packIds.add(packId);

    const byPack: PackIncome[] = [];
    for (const listing of listings) {
      if (!packIds.has(listing.pack.id)) continue;
      if (byPack.some((p) => p.packId === listing.pack.id)) continue;

      const income = incomeByPack.get(listing.pack.id) || 0;
      const fees = feesByPack.get(listing.pack.id) || 0;
      const withdrawn = withdrawnByPack.get(listing.pack.id) || 0;
      const netIncome = income - fees;

      byPack.push({
        packId: listing.pack.id,
        packSku: listing.pack.sku,
        packName: listing.pack.name,
        income: Math.round(income * 100) / 100,
        fees: Math.round(fees * 100) / 100,
        netIncome: Math.round(netIncome * 100) / 100,
        withdrawn: Math.round(withdrawn * 100) / 100,
        balance: Math.round((netIncome - withdrawn) * 100) / 100,
      });
    }

    byPack.sort((a, b) => b.income - a.income);

    // Build recent transactions
    const recentTransactions: RecentTransaction[] = [];

    if (hasMPData) {
      // Use MP transactions for the timeline
      for (const tx of mpTransactions.slice(0, 30)) {
        const amount = decimalToNumber(tx.amount);
        const label = tx.label;

        let type: RecentTransaction["type"] = "mp_movement";
        if (label === "sale") type = "income";
        else if (label === "fee" || label === "commission") type = "fee";

        recentTransactions.push({
          type,
          date: tx.dateCreated.toISOString(),
          amount: tx.type === "debit" ? -Math.abs(amount) : amount,
          description: tx.description || `Movimiento MP: ${label}`,
          label,
        });
      }
    } else {
      for (const order of orders) {
        recentTransactions.push({
          type: "income",
          date: order.dateCreated.toISOString(),
          amount: decimalToNumber(order.totalAmount),
          description: `Venta ${order.mlItemId}`,
        });
      }
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
        totalFees: Math.round(totalFees * 100) / 100,
        totalShippingFees: Math.round(totalShippingFees * 100) / 100,
        totalWithdrawn: Math.round(totalWithdrawn * 100) / 100,
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        mpBalance: Math.round(mpBalance * 100) / 100,
        unallocatedWithdrawals: Math.round(unallocatedWithdrawals * 100) / 100,
        hasMPData,
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
