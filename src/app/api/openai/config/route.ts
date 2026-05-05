export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { verifyAnyAuth } from "@/lib/api-auth";
import { getOpenAIKey, setOpenAIKey, deleteOpenAIKey } from "@/lib/openai/client";

export async function GET(request: NextRequest) {
  const user = await verifyAnyAuth(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const apiKey = await getOpenAIKey();
  return NextResponse.json({
    configured: !!apiKey,
    maskedKey: apiKey ? "sk-****" + apiKey.slice(-4) : null,
  });
}

export async function PUT(request: NextRequest) {
  const user = await verifyAnyAuth(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const { apiKey } = body;

  if (!apiKey || typeof apiKey !== "string" || !apiKey.startsWith("sk-")) {
    return NextResponse.json(
      { error: "API key invalida. Debe comenzar con 'sk-'" },
      { status: 400 }
    );
  }

  await setOpenAIKey(apiKey);
  return NextResponse.json({ success: true, maskedKey: "sk-****" + apiKey.slice(-4) });
}

export async function DELETE(request: NextRequest) {
  const user = await verifyAnyAuth(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await deleteOpenAIKey();
  return NextResponse.json({ success: true });
}
