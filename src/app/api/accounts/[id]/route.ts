export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAnyAuth } from "@/lib/api-auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifyAnyAuth(request);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const account = await prisma.account.update({
    where: { id },
    data: {
      ...(body.name && { name: body.name }),
      ...(body.color && { color: body.color }),
      ...(body.isDefault !== undefined && { isDefault: body.isDefault }),
    },
  });

  return NextResponse.json(account);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifyAnyAuth(request);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;

  const count = await prisma.expense.count({ where: { accountId: id } });
  const wCount = await prisma.withdrawal.count({ where: { accountId: id } });
  if (count > 0 || wCount > 0) {
    return NextResponse.json({ error: "No se puede eliminar: tiene gastos o retiros asignados" }, { status: 400 });
  }

  await prisma.account.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
