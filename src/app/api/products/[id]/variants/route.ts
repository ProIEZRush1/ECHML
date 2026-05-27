import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { verifyAnyAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const createVariantSchema = z.object({
  id: z.string().optional(),
  variantLabel: z.string().min(1),
  stock: z.number().int().min(0).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id: productId } = await params;
  const body = await request.json();
  const parsed = createVariantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  const variant = await prisma.productVariant.create({
    data: {
      id: parsed.data.id,
      productId,
      variantLabel: parsed.data.variantLabel,
      stock: parsed.data.stock ?? 0,
    },
  });

  return NextResponse.json(variant, { status: 201 });
}
