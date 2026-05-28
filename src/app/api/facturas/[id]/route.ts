import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAnyAuth } from "@/lib/api-auth";
import { parseLocalDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;

  const factura = await prisma.factura.findUnique({
    where: { id },
    include: {
      productGroup: { select: { id: true, name: true, color: true } },
    },
  });

  if (!factura) {
    return NextResponse.json(
      { error: "Factura no encontrada" },
      { status: 404 }
    );
  }

  return NextResponse.json(factura);
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
  const body = await request.json();

  const factura = await prisma.factura.findUnique({ where: { id } });
  if (!factura) {
    return NextResponse.json(
      { error: "Factura no encontrada" },
      { status: 404 }
    );
  }

  if (body.productGroupId) {
    const group = await prisma.productGroup.findUnique({
      where: { id: body.productGroupId },
    });
    if (!group) {
      return NextResponse.json(
        { error: "Grupo de producto no encontrado" },
        { status: 404 }
      );
    }
  }

  const updated = await prisma.factura.update({
    where: { id },
    data: {
      ...(body.folio !== undefined && { folio: body.folio || null }),
      ...(body.rfcEmisor !== undefined && { rfcEmisor: body.rfcEmisor || null }),
      ...(body.rfcReceptor !== undefined && { rfcReceptor: body.rfcReceptor || null }),
      ...(body.fechaEmision !== undefined && {
        fechaEmision: body.fechaEmision ? parseLocalDate(body.fechaEmision) : null,
      }),
      ...(body.subtotal !== undefined && { subtotal: body.subtotal }),
      ...(body.iva !== undefined && { iva: body.iva }),
      ...(body.total !== undefined && { total: body.total }),
      ...(body.conceptos !== undefined && { conceptos: body.conceptos || null }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.productGroupId !== undefined && {
        productGroupId: body.productGroupId || null,
      }),
      ...(body.notes !== undefined && { notes: body.notes || null }),
      ...(body.pdfData !== undefined && { pdfData: body.pdfData || null }),
    },
    include: {
      productGroup: { select: { id: true, name: true, color: true } },
    },
  });

  return NextResponse.json(updated);
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

  const factura = await prisma.factura.findUnique({ where: { id } });
  if (!factura) {
    return NextResponse.json(
      { error: "Factura no encontrada" },
      { status: 404 }
    );
  }

  await prisma.factura.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
