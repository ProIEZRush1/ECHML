export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { verifyAnyAuth } from "@/lib/api-auth";
import { parseLocalDate } from "@/lib/utils";

const createSchema = z.object({
  fromAccountId: z.string().min(1),
  toAccountId: z.string().min(1),
  amount: z.number().positive(),
  date: z.string().min(1),
  concept: z.string().min(1),
  notes: z.string().optional(),
  hasFactura: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const transfers = await prisma.accountTransfer.findMany({
    include: {
      fromAccount: { select: { id: true, name: true, color: true } },
      toAccount: { select: { id: true, name: true, color: true } },
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(transfers);
}

export async function POST(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await request.json();
  const result = createSchema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });

  if (result.data.fromAccountId === result.data.toAccountId) {
    return NextResponse.json({ error: "Las cuentas deben ser diferentes" }, { status: 400 });
  }

  const transfer = await prisma.accountTransfer.create({
    data: {
      fromAccountId: result.data.fromAccountId,
      toAccountId: result.data.toAccountId,
      amount: result.data.amount,
      date: parseLocalDate(result.data.date),
      concept: result.data.concept,
      notes: result.data.notes,
      hasFactura: result.data.hasFactura || false,
      userId: session.id,
    },
    include: {
      fromAccount: { select: { id: true, name: true, color: true } },
      toAccount: { select: { id: true, name: true, color: true } },
    },
  });

  return NextResponse.json(transfer, { status: 201 });
}
