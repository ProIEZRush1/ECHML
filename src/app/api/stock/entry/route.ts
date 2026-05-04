import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { verifySession } from "@/lib/auth";
import { addStock } from "@/lib/stock/engine";

const stockEntrySchema = z.object({
  supplierId: z.string().min(1),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      productVariantId: z.string().min(1),
      quantity: z.number().int().positive(),
      unitCost: z.number().min(0),
    })
  ).min(1),
});

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const result = stockEntrySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Datos invalidos", details: result.error.issues },
        { status: 400 }
      );
    }

    const { supplierId, notes, items } = result.data;

    await addStock(items, supplierId, session.userId, notes);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error en entrada de stock:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
