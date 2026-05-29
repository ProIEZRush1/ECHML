import { NextRequest, NextResponse } from "next/server";
import { verifyAnyAuth } from "@/lib/api-auth";
import { getRealMpBalance, setManualMpBalance } from "@/lib/mp/balance";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  return NextResponse.json(await getRealMpBalance());
}

export async function POST(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const disponible = Number((body as Record<string, unknown>).disponible);
  const futuro = Number((body as Record<string, unknown>).futuro);
  const note = typeof (body as Record<string, unknown>).note === "string" ? ((body as Record<string, string>).note) : undefined;

  if (Number.isNaN(disponible) || Number.isNaN(futuro)) {
    return NextResponse.json({ error: "disponible y futuro deben ser números" }, { status: 400 });
  }

  await setManualMpBalance(disponible, futuro, note);
  return NextResponse.json(await getRealMpBalance());
}
