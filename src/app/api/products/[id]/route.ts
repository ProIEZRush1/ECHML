import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { verifyAnyAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  supplierCode: z.string().min(1).optional(),
  unitCost: z.number().min(0).optional(),
  description: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
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

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, name: true } },
      variants: {
        select: {
          id: true,
          color: true,
          variantLabel: true,
          stock: true,
          packItems: {
            select: {
              pack: { select: { id: true, sku: true, name: true } },
              quantity: true,
            },
          },
          stockLogs: {
            select: {
              id: true,
              changeType: true,
              quantityChange: true,
              previousStock: true,
              newStock: true,
              reason: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 50,
          },
        },
        orderBy: { color: "asc" },
      },
    },
  });

  if (!product) {
    return NextResponse.json(
      { error: "Producto no encontrado" },
      { status: 404 }
    );
  }

  return NextResponse.json(product);
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
    const result = updateProductSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Datos invalidos", details: result.error.issues },
        { status: 400 }
      );
    }

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 404 }
      );
    }

    const product = await prisma.product.update({
      where: { id },
      data: result.data,
      include: {
        variants: {
          select: { id: true, color: true, variantLabel: true, stock: true },
          orderBy: { color: "asc" },
        },
        supplier: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(product);
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
    console.error("Error al actualizar producto:", error);
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

  const isVariantDelete = request.nextUrl.searchParams.get("variant") === "true";
  if (isVariantDelete) {
    await prisma.packItem.deleteMany({ where: { productVariantId: id } });
    await prisma.stockLog.deleteMany({ where: { productVariantId: id } });
    await prisma.stockEntryItem.deleteMany({ where: { productVariantId: id } });
    await prisma.productVariant.delete({ where: { id } });
    return NextResponse.json({ deleted: id, type: "variant" });
  }

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      variants: {
        include: {
          packItems: { select: { id: true } },
        },
      },
    },
  });

  if (!product) {
    return NextResponse.json(
      { error: "Producto no encontrado" },
      { status: 404 }
    );
  }

  const usedInPack = product.variants.some((v) => v.packItems.length > 0);
  if (usedInPack) {
    return NextResponse.json(
      { error: "No se puede eliminar el producto porque tiene variantes usadas en packs" },
      { status: 409 }
    );
  }

  await prisma.product.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
