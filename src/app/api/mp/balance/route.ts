import { NextRequest, NextResponse } from "next/server";
import { verifyAnyAuth } from "@/lib/api-auth";
import { getMPBalance } from "@/lib/mp/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  try {
    const balance = await getMPBalance();
    return NextResponse.json(balance);
  } catch (error: unknown) {
    console.error("Error al obtener balance MP:", error);
    const message =
      error instanceof Error ? error.message : "Error interno del servidor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
