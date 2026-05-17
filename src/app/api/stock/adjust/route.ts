export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { verifyAnyAuth } from "@/lib/api-auth";
import { adjustStock } from "@/lib/stock/engine";

export async function POST(request: NextRequest) {
  const user = await verifyAnyAuth(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const { productVariantId, newStock, reason } = body;

  if (!productVariantId || newStock === undefined || newStock < 0) {
    return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
  }

  await adjustStock(productVariantId, newStock, reason || "Ajuste manual", user.id);

  return NextResponse.json({ success: true, productVariantId, newStock });
}
