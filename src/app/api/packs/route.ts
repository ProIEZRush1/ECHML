import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { verifyAnyAuth } from "@/lib/api-auth";
import { recalculateAffectedPacks } from "@/lib/stock/engine";

export const dynamic = "force-dynamic";

const createPackSchema = z.object({
  sku: z.string().min(1, "El SKU es obligatorio"),
  name: z.string().min(1, "El nombre es obligatorio"),
  salePrice: z.number().min(0, "El precio de venta debe ser mayor o igual a 0"),
  description: z.string().optional(),
  items: z
    .array(
      z.object({
        productVariantId: z.string().min(1, "La variante es obligatoria"),
        quantity: z.number().int().positive("La cantidad debe ser mayor a 0"),
      })
    )
    .min(1, "El pack debe tener al menos un item"),
});

export async function GET(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  const packs = await prisma.pack.findMany({
    include: {
      items: {
        include: {
          productVariant: {
            include: {
              product: { select: { id: true, name: true, supplierCode: true } },
            },
          },
        },
      },
      _count: {
        select: { mlListings: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(packs);
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
    const result = createPackSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Datos invalidos", details: result.error.issues },
        { status: 400 }
      );
    }

    const { sku, name, salePrice, description, items } = result.data;

    const variantIds = items.map((i) => i.productVariantId);
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: { id: true },
    });

    if (variants.length !== variantIds.length) {
      return NextResponse.json(
        { error: "Una o mas variantes de producto no existen" },
        { status: 404 }
      );
    }

    const pack = await prisma.$transaction(async (tx) => {
      const created = await tx.pack.create({
        data: {
          sku,
          name,
          salePrice,
          description,
          items: {
            create: items.map((item) => ({
              productVariantId: item.productVariantId,
              quantity: item.quantity,
            })),
          },
        },
        include: {
          items: {
            include: {
              productVariant: {
                include: {
                  product: { select: { id: true, name: true, supplierCode: true } },
                },
              },
            },
          },
        },
      });

      return created;
    });

    await recalculateAffectedPacks(variantIds);

    return NextResponse.json(pack, { status: 201 });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Ya existe un pack con ese SKU" },
        { status: 409 }
      );
    }
    console.error("Error al crear pack:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
