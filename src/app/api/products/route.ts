import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";

export async function GET() {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      supplierCode: true,
      variants: {
        select: { id: true, color: true },
        orderBy: { color: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(products);
}
