import { NextRequest, NextResponse } from "next/server";
import { verifyAnyAuth } from "@/lib/api-auth";
import { syncMPTransactions } from "@/lib/mp/client";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  try {
    const result = await syncMPTransactions();

    return NextResponse.json({
      message: `Sincronizacion completada: ${result.synced} movimientos procesados de ${result.total} total.`,
      synced: result.synced,
      total: result.total,
    });
  } catch (error: unknown) {
    console.error("Error al sincronizar MP:", error);
    const message =
      error instanceof Error ? error.message : "Error interno del servidor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
