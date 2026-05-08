import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAnyAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  const { id } = await params;

  const body = await request.json();
  const { amount } = body;

  if (typeof amount !== "number" || isNaN(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "Monto invalido" },
      { status: 400 }
    );
  }

  const tx = await prisma.mPTransaction.findUnique({ where: { id } });
  if (!tx) {
    return NextResponse.json(
      { error: "Transaccion no encontrada" },
      { status: 404 }
    );
  }

  if (tx.label !== "flex_cost") {
    return NextResponse.json(
      { error: "Solo se puede editar el monto de transacciones flex_cost" },
      { status: 403 }
    );
  }

  // flex_cost transactions are debits: amount is negative, balanceChange mirrors it
  const oldAmount = Number(tx.amount);
  const oldBalance = Number(tx.balanceChange);

  // Preserve the sign: if original amount was negative, new amount is also negative
  const newAmount = oldAmount < 0 ? -Math.abs(amount) : Math.abs(amount);
  const balanceDelta = newAmount - oldAmount;
  const newBalance = oldBalance + balanceDelta;

  const updated = await prisma.mPTransaction.update({
    where: { id },
    data: {
      amount: newAmount,
      balanceChange: newBalance,
    },
  });

  return NextResponse.json({
    id: updated.id,
    amount: Number(updated.amount),
    balanceChange: Number(updated.balanceChange),
  });
}
