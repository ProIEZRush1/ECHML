import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { verifyAnyAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const updateGroupSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").optional(),
  color: z.string().optional(),
  facturaSobreMercancia: z.boolean().optional(),
  productIds: z.array(z.string()).min(1, "Debe incluir al menos un producto").optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;

  const group = await prisma.productGroup.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, brand: true, supplierCode: true },
          },
        },
      },
    },
  });

  if (!group) {
    return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    id: group.id,
    name: group.name,
    color: group.color,
    createdAt: group.createdAt,
    products: group.items.map((i) => i.product),
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const result = updateGroupSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Datos invalidos", details: result.error.issues },
        { status: 400 }
      );
    }

    const { name, color, facturaSobreMercancia, productIds } = result.data;

    const existing = await prisma.productGroup.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
    }

    const group = await prisma.$transaction(async (tx) => {
      if (productIds) {
        await tx.productGroupItem.deleteMany({ where: { productGroupId: id } });
        await tx.productGroupItem.createMany({
          data: productIds.map((productId) => ({ productGroupId: id, productId })),
        });
      }

      return tx.productGroup.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(color !== undefined && { color }),
          ...(facturaSobreMercancia !== undefined && { facturaSobreMercancia }),
        },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, brand: true } },
            },
          },
        },
      });
    });

    return NextResponse.json({
      id: group.id,
      name: group.name,
      color: group.color,
      productCount: group.items.length,
      products: group.items.map((i) => i.product),
    });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Ya existe un grupo con ese nombre" },
        { status: 409 }
      );
    }
    console.error("Error al actualizar grupo:", error);
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
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.productGroup.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
  }

  await prisma.productGroup.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
