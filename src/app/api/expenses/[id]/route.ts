import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAnyAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) {
    return NextResponse.json({ error: "Gasto no encontrado" }, { status: 404 });
  }

  const updated = await prisma.expense.update({
    where: { id },
    data: {
      ...(body.amount !== undefined && { amount: body.amount }),
      ...(body.concept !== undefined && { concept: body.concept }),
      ...(body.category !== undefined && { category: body.category }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.date !== undefined && { date: new Date(body.date) }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.productId !== undefined && { productId: body.productId || null }),
      ...(body.packId !== undefined && { packId: body.packId || null }),
      ...(body.supplierId !== undefined && { supplierId: body.supplierId || null }),
      ...(body.accountId !== undefined && { accountId: body.accountId || null }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
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

  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) {
    return NextResponse.json(
      { error: "Gasto no encontrado" },
      { status: 404 }
    );
  }

  await prisma.expense.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
