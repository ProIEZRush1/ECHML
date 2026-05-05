import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { verifyAnyAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const variantSchema = z.object({
  color: z.enum(["AZUL", "VERDE", "ROSA", "MORADO"]).optional(),
  variantLabel: z.string().min(1).optional(),
  stock: z.number().int().min(0).optional(),
});

const createProductSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  supplierCode: z.string().min(1, "El codigo de proveedor es obligatorio"),
  unitCost: z.number().min(0, "El costo unitario debe ser mayor o igual a 0"),
  supplierId: z.string().min(1, "El proveedor es obligatorio"),
  description: z.string().optional(),
  brand: z.string().optional(),
  variants: z.array(variantSchema).optional(),
});

export async function GET(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  const products = await prisma.product.findMany({
    include: {
      variants: {
        select: { id: true, color: true, variantLabel: true, stock: true },
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
  const session = await verifyAnyAuth(request);
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

    const { name, supplierCode, unitCost, supplierId, description, brand, variants } = result.data;

    const supplierExists = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });
    if (!supplierExists) {
      return NextResponse.json(
        { error: "El proveedor no existe" },
        { status: 404 }
      );
    }

    // Determine variants to create
    let variantsToCreate: { color?: "AZUL" | "VERDE" | "ROSA" | "MORADO"; variantLabel?: string; stock: number }[];

    if (variants && variants.length > 0) {
      // Custom variants provided
      variantsToCreate = variants.map((v) => ({
        color: v.color as "AZUL" | "VERDE" | "ROSA" | "MORADO" | undefined,
        variantLabel: v.variantLabel,
        stock: v.stock ?? 0,
      }));
    } else {
      // Default: 4 standard color variants
      variantsToCreate = [
        { color: "AZUL", stock: 0 },
        { color: "VERDE", stock: 0 },
        { color: "ROSA", stock: 0 },
        { color: "MORADO", stock: 0 },
      ];
    }

    const product = await prisma.product.create({
      data: {
        name,
        supplierCode,
        unitCost,
        supplierId,
        description,
        brand,
        variants: {
          create: variantsToCreate.map((v) => ({
            color: v.color ?? null,
            variantLabel: v.variantLabel ?? null,
            stock: v.stock,
          })),
        },
      },
      include: {
        variants: {
          select: { id: true, color: true, variantLabel: true, stock: true },
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
