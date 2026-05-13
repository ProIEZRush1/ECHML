import { NextRequest, NextResponse } from "next/server";
import { verifyAnyAuth } from "@/lib/api-auth";
import { syncOrdersFromML } from "@/lib/mp/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const result = await syncOrdersFromML();

    return NextResponse.json({
      message: `Sincronizacion completada: ${result.synced} ordenes procesadas de ${result.total} total. Comisiones: $${result.fees.toFixed(2)}, Ingresos netos: $${result.revenue.toFixed(2)}`,
      synced: result.synced,
      total: result.total,
      fees: result.fees,
      revenue: result.revenue,
    });
  } catch (error: unknown) {
    console.error("Error al sincronizar MP:", error);
    const message = error instanceof Error ? error.message : "Error interno del servidor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
