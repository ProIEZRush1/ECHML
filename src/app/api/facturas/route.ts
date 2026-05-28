import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { verifyAnyAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const createFacturaSchema = z.object({
  total: z.number().positive("El total debe ser mayor a 0"),
  folio: z.string().optional(),
  rfcEmisor: z.string().optional(),
  rfcReceptor: z.string().optional(),
  fechaEmision: z.string().optional(),
  subtotal: z.number().optional(),
  iva: z.number().optional(),
  conceptos: z.string().optional(),
  status: z.string().optional(),
  productGroupId: z.string().optional(),
  notes: z.string().optional(),
  pdfData: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const productGroupId = searchParams.get("productGroupId");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (productGroupId) where.productGroupId = productGroupId;
  if (status) where.status = status;

  const facturas = await prisma.factura.findMany({
    where,
    include: {
      productGroup: { select: { id: true, name: true, color: true } },
    },
    orderBy: [{ fechaEmision: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(facturas);
}

export async function POST(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = createFacturaSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: result.error.issues },
        { status: 400 }
      );
    }

    const data = result.data;

    if (data.productGroupId) {
      const group = await prisma.productGroup.findUnique({
        where: { id: data.productGroupId },
      });
      if (!group) {
        return NextResponse.json(
          { error: "Grupo de producto no encontrado" },
          { status: 404 }
        );
      }
    }

    const factura = await prisma.factura.create({
      data: {
        total: data.total,
        folio: data.folio || null,
        rfcEmisor: data.rfcEmisor || null,
        rfcReceptor: data.rfcReceptor || null,
        fechaEmision: data.fechaEmision ? new Date(data.fechaEmision) : null,
        subtotal: data.subtotal ?? null,
        iva: data.iva ?? null,
        conceptos: data.conceptos || null,
        status: data.status || "pendiente",
        productGroupId: data.productGroupId || null,
        notes: data.notes || null,
        pdfData: data.pdfData || null,
      },
      include: {
        productGroup: { select: { id: true, name: true, color: true } },
      },
    });

    return NextResponse.json(factura, { status: 201 });
  } catch (error: unknown) {
    console.error("Error al crear factura:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
