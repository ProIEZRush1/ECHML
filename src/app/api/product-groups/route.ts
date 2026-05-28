import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { verifyAnyAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const createGroupSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  color: z.string().optional(),
  productIds: z.array(z.string()).min(1, "Debe incluir al menos un producto"),
});

export async function GET(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const groups = await prisma.productGroup.findMany({
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, brand: true },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const result = groups.map((g) => ({
    id: g.id,
    name: g.name,
    color: g.color,
    facturaSobreMercancia: g.facturaSobreMercancia,
    createdAt: g.createdAt,
    productCount: g.items.length,
    products: g.items.map((i) => i.product),
  }));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = createGroupSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Datos invalidos", details: result.error.issues },
        { status: 400 }
      );
    }

    const { name, color, productIds } = result.data;

    const group = await prisma.productGroup.create({
      data: {
        name,
        color: color || "#6b7280",
        items: {
          create: productIds.map((productId) => ({ productId })),
        },
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, brand: true } },
          },
        },
      },
    });

    return NextResponse.json(
      {
        id: group.id,
        name: group.name,
        color: group.color,
        productCount: group.items.length,
        products: group.items.map((i) => i.product),
      },
      { status: 201 }
    );
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
    console.error("Error al crear grupo:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
