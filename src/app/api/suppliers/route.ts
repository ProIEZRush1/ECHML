import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const createSupplierSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  contact: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  const suppliers = await prisma.supplier.findMany({
    select: { id: true, name: true, contact: true, phone: true, notes: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(suppliers);
}

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
    const result = createSupplierSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Datos invalidos", details: result.error.issues },
        { status: 400 }
      );
    }

    const supplier = await prisma.supplier.create({
      data: result.data,
      select: { id: true, name: true, contact: true, phone: true, notes: true },
    });

    return NextResponse.json(supplier, { status: 201 });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Ya existe un proveedor con ese nombre" },
        { status: 409 }
      );
    }
    console.error("Error al crear proveedor:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
