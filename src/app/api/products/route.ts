import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const createProductSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  supplierCode: z.string().min(1, "El codigo de proveedor es obligatorio"),
  unitCost: z.number().min(0, "El costo unitario debe ser mayor o igual a 0"),
  supplierId: z.string().min(1, "El proveedor es obligatorio"),
  description: z.string().optional(),
});

export async function GET() {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  const products = await prisma.product.findMany({
    include: {
      variants: {
        select: { id: true, color: true, stock: true },
        orderBy: { color: "asc" },
      },
      supplier: {
        select: { id: true, name: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(products);
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
    const result = createProductSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Datos invalidos", details: result.error.issues },
        { status: 400 }
      );
    }

    const { name, supplierCode, unitCost, supplierId, description } = result.data;

    const supplierExists = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });
    if (!supplierExists) {
      return NextResponse.json(
        { error: "El proveedor no existe" },
        { status: 404 }
      );
    }

    const product = await prisma.product.create({
      data: {
        name,
        supplierCode,
        unitCost,
        supplierId,
        description,
        variants: {
          create: [
            { color: "AZUL", stock: 0 },
            { color: "VERDE", stock: 0 },
            { color: "ROSA", stock: 0 },
            { color: "MORADO", stock: 0 },
          ],
        },
      },
      include: {
        variants: {
          select: { id: true, color: true, stock: true },
          orderBy: { color: "asc" },
        },
        supplier: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Ya existe un producto con ese codigo de proveedor para este proveedor" },
        { status: 409 }
      );
    }
    console.error("Error al crear producto:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
