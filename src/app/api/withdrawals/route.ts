import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { verifyAnyAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const allocationSchema = z.object({
  packId: z.string().optional(),
  productId: z.string().optional(),
  amount: z.number().refine((n) => n !== 0, "El monto no puede ser 0"),
  notes: z.string().optional(),
});

const createWithdrawalSchema = z.object({
  amount: z.number().refine((n) => n !== 0, "El monto no puede ser 0"),
  date: z.string().min(1, "La fecha es obligatoria"),
  concept: z.string().min(1, "El concepto es obligatorio"),
  method: z.string().default("bank"),
  reference: z.string().optional(),
  notes: z.string().optional(),
  hasFactura: z.boolean().optional(),
  productGroupId: z.string().optional(),
  accountId: z.string().optional(),
  toAccountId: z.string().optional(),
  allocations: z.array(allocationSchema).optional(),
});

export async function GET(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  const withdrawals = await prisma.withdrawal.findMany({
    include: {
      allocations: {
        include: {
          pack: { select: { id: true, sku: true, name: true } },
          product: { select: { id: true, name: true, supplierCode: true } },
        },
      },
      user: { select: { id: true, name: true } },
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(withdrawals);
}

export async function POST(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const result = createWithdrawalSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: result.error.issues },
        { status: 400 }
      );
    }

    const { amount, date, concept, method, reference, notes, allocations } = result.data;

    if (allocations && allocations.length > 0) {
      const allocationsSum = allocations.reduce((sum, a) => sum + a.amount, 0);
      if (allocationsSum > amount) {
        return NextResponse.json(
          { error: "La suma de asignaciones no puede superar el monto del retiro" },
          { status: 400 }
        );
      }

      for (const alloc of allocations) {
        if (!alloc.packId && !alloc.productId) {
          return NextResponse.json(
            { error: "Cada asignación debe tener un packId o productId" },
            { status: 400 }
          );
        }
      }
    }

    const withdrawal = await prisma.$transaction(async (tx) => {
      const created = await tx.withdrawal.create({
        data: {
          amount,
          date: new Date(date),
          concept,
          method,
          reference,
          notes,
          hasFactura: result.data.hasFactura || false,
          productGroupId: result.data.productGroupId || null,
          accountId: result.data.accountId || null,
          toAccountId: result.data.toAccountId || null,
          userId: session.id,
          allocations: allocations && allocations.length > 0
            ? {
                create: allocations.map((alloc) => ({
                  packId: alloc.packId || null,
                  productId: alloc.productId || null,
                  amount: alloc.amount,
                  notes: alloc.notes,
                })),
              }
            : undefined,
        },
        include: {
          allocations: {
            include: {
              pack: { select: { id: true, sku: true, name: true } },
              product: { select: { id: true, name: true, supplierCode: true } },
            },
          },
          user: { select: { id: true, name: true } },
        },
      });

      return created;
    });

    return NextResponse.json(withdrawal, { status: 201 });
  } catch (error: unknown) {
    console.error("Error al crear retiro:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
