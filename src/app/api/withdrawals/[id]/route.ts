import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { verifyAnyAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const allocationSchema = z.object({
  packId: z.string().optional(),
  productId: z.string().optional(),
  amount: z.number().positive("El monto de asignación debe ser mayor a 0"),
  notes: z.string().optional(),
});

const updateWithdrawalSchema = z.object({
  amount: z.number().positive("El monto debe ser mayor a 0").optional(),
  date: z.string().optional(),
  concept: z.string().min(1).optional(),
  method: z.string().optional(),
  reference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  productGroupId: z.string().nullable().optional(),
  allocations: z.array(allocationSchema).optional(),
});

export async function GET(
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

  const withdrawal = await prisma.withdrawal.findUnique({
    where: { id },
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

  if (!withdrawal) {
    return NextResponse.json(
      { error: "Retiro no encontrado" },
      { status: 404 }
    );
  }

  return NextResponse.json(withdrawal);
}

export async function PUT(
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

  try {
    const body = await request.json();
    const result = updateWithdrawalSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: result.error.issues },
        { status: 400 }
      );
    }

    const existing = await prisma.withdrawal.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Retiro no encontrado" },
        { status: 404 }
      );
    }

    const { allocations, ...fields } = result.data;
    const effectiveAmount = fields.amount ?? Number(existing.amount);

    if (allocations && allocations.length > 0) {
      const allocationsSum = allocations.reduce((sum, a) => sum + a.amount, 0);
      if (allocationsSum > effectiveAmount) {
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
      if (allocations !== undefined) {
        await tx.withdrawalAllocation.deleteMany({ where: { withdrawalId: id } });

        if (allocations.length > 0) {
          await tx.withdrawalAllocation.createMany({
            data: allocations.map((alloc) => ({
              withdrawalId: id,
              packId: alloc.packId || null,
              productId: alloc.productId || null,
              amount: alloc.amount,
              notes: alloc.notes,
            })),
          });
        }
      }

      const updateData: Record<string, unknown> = {};
      if (fields.amount !== undefined) updateData.amount = fields.amount;
      if (fields.date !== undefined) updateData.date = new Date(fields.date);
      if (fields.concept !== undefined) updateData.concept = fields.concept;
      if (fields.method !== undefined) updateData.method = fields.method;
      if (fields.reference !== undefined) updateData.reference = fields.reference;
      if (fields.notes !== undefined) updateData.notes = fields.notes;
      if (fields.productGroupId !== undefined) updateData.productGroupId = fields.productGroupId || null;

      return tx.withdrawal.update({
        where: { id },
        data: updateData,
        include: {
          allocations: {
            include: {
              pack: { select: { id: true, sku: true, name: true } },
              product: { select: { id: true, name: true, supplierCode: true } },
            },
          },
          user: { select: { id: true, name: true } },
          productGroup: { select: { id: true, name: true } },
        },
      });
    });

    return NextResponse.json(withdrawal);
  } catch (error: unknown) {
    console.error("Error al actualizar retiro:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
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

  const withdrawal = await prisma.withdrawal.findUnique({ where: { id } });
  if (!withdrawal) {
    return NextResponse.json(
      { error: "Retiro no encontrado" },
      { status: 404 }
    );
  }

  await prisma.withdrawal.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
