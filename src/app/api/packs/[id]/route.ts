import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";
import { recalculateAffectedPacks } from "@/lib/stock/engine";

export const dynamic = "force-dynamic";

const updatePackSchema = z.object({
  sku: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  salePrice: z.number().min(0).optional(),
  description: z.string().nullable().optional(),
  items: z
    .array(
      z.object({
        productVariantId: z.string().min(1),
        quantity: z.number().int().positive(),
      })
    )
    .min(1)
    .optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  const { id } = await params;

  const pack = await prisma.pack.findUnique({
    where: { id },
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
      mlListings: {
        select: {
          id: true,
          mlItemId: true,
          title: true,
          status: true,
          currentStock: true,
          permalink: true,
        },
      },
    },
  });

  if (!pack) {
    return NextResponse.json(
      { error: "Pack no encontrado" },
      { status: 404 }
    );
  }

  return NextResponse.json(pack);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const result = updatePackSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Datos invalidos", details: result.error.issues },
        { status: 400 }
      );
    }

    const existing = await prisma.pack.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Pack no encontrado" },
        { status: 404 }
      );
    }

    const { items, ...fields } = result.data;

    if (items) {
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
    }

    const pack = await prisma.$transaction(async (tx) => {
      if (items) {
        await tx.packItem.deleteMany({ where: { packId: id } });
        await tx.packItem.createMany({
          data: items.map((item) => ({
            packId: id,
            productVariantId: item.productVariantId,
            quantity: item.quantity,
          })),
        });
      }

      return tx.pack.update({
        where: { id },
        data: fields,
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
    });

    const affectedVariantIds = items
      ? [
          ...items.map((i) => i.productVariantId),
          ...existing.items.map((i) => i.productVariantId),
        ]
      : existing.items.map((i) => i.productVariantId);

    await recalculateAffectedPacks([...new Set(affectedVariantIds)]);

    return NextResponse.json(pack);
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
    console.error("Error al actualizar pack:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  const { id } = await params;

  const pack = await prisma.pack.findUnique({
    where: { id },
    include: {
      items: { select: { productVariantId: true } },
      mlListings: { select: { id: true } },
    },
  });

  if (!pack) {
    return NextResponse.json(
      { error: "Pack no encontrado" },
      { status: 404 }
    );
  }

  if (pack.mlListings.length > 0) {
    return NextResponse.json(
      { error: "No se puede eliminar el pack porque tiene publicaciones de MercadoLibre vinculadas" },
      { status: 409 }
    );
  }

  const affectedVariantIds = pack.items.map((i) => i.productVariantId);

  await prisma.pack.delete({ where: { id } });

  await recalculateAffectedPacks(affectedVariantIds);

  return NextResponse.json({ success: true });
}
