import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAnyAuth } from "@/lib/api-auth";
import { reverseManualSale } from "@/lib/stock/engine";

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

  const sale = await prisma.mPTransaction.findUnique({ where: { id } });
  // Guard: solo se pueden borrar ventas MANUALES desde aqui (nunca tocar filas de ML).
  if (!sale || sale.source !== "manual") {
    return NextResponse.json({ error: "Venta manual no encontrada" }, { status: 404 });
  }

  try {
    // Borramos PRIMERO la fila. Asi un reintento (si la respuesta se pierde) da 404 y
    // no revierte el stock dos veces (lo que inflaria el inventario silenciosamente).
    await prisma.mPTransaction.delete({ where: { id } });

    // Si la venta descontó stock (type='manual_sale'), lo regresamos al inventario.
    if (sale.type === "manual_sale" && sale.packId) {
      try {
        await reverseManualSale(sale.packId, sale.quantity, session.id, `Reverso venta manual #${sale.id}`);
      } catch (stockErr) {
        // La venta ya se borró (estado de dinero correcto). Si la reversión de stock falla,
        // se registra para ajuste manual en vez de dejar la venta sin borrar.
        console.error(`Venta manual ${id} borrada pero fallo el reverso de stock:`, stockErr);
        return NextResponse.json({ ok: true, stockReverseFailed: true });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error("Error al borrar venta manual:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
