import { NextRequest, NextResponse } from "next/server";
import { verifyAnyAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await prisma.packItem.deleteMany({ where: { productVariantId: id } });
    await prisma.stockEntryItem.deleteMany({ where: { productVariantId: id } });
    await prisma.stockLog.deleteMany({ where: { productVariantId: id } });
    await prisma.productVariant.delete({ where: { id } });

    return NextResponse.json({ deleted: id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
