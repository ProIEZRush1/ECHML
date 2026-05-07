import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { verifyAnyAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const EXPENSE_CATEGORIES = ["proveedor", "envio", "suscripcion", "publicidad", "empaque", "otro"] as const;

const createExpenseSchema = z.object({
  amount: z.number().positive("El monto debe ser mayor a 0"),
  date: z.string().min(1, "La fecha es obligatoria"),
  category: z.enum(EXPENSE_CATEGORIES, {
    error: "Categoría inválida. Opciones: proveedor, envio, suscripcion, publicidad, otro",
  }),
  concept: z.string().min(1, "El concepto es obligatorio"),
  type: z.enum(["gasto", "compra"]).optional(),
  supplierId: z.string().optional(),
  productId: z.string().optional(),
  packId: z.string().optional(),
  productGroupId: z.string().optional(),
  transactionIds: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  const expenses = await prisma.expense.findMany({
    include: {
      supplier: { select: { id: true, name: true } },
      product: { select: { id: true, name: true } },
      pack: { select: { id: true, sku: true, name: true } },
      productGroup: { select: { id: true, name: true } },
      user: { select: { id: true, name: true } },
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(expenses);
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
    const result = createExpenseSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: result.error.issues },
        { status: 400 }
      );
    }

    const { amount, date, category, concept, type, supplierId, productId, packId, productGroupId, transactionIds, notes } = result.data;

    if (supplierId) {
      const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
      if (!supplier) {
        return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });
      }
    }

    const expense = await prisma.expense.create({
      data: {
        type: type || "gasto",
        amount,
        date: new Date(date),
        category,
        concept,
        supplierId: supplierId || null,
        productId: productId || null,
        packId: packId || null,
        productGroupId: productGroupId || null,
        transactionIds: transactionIds || null,
        notes,
        userId: session.id,
      },
      include: {
        supplier: { select: { id: true, name: true } },
        product: { select: { id: true, name: true } },
        pack: { select: { id: true, sku: true, name: true } },
        productGroup: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error: unknown) {
    console.error("Error al crear gasto:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
