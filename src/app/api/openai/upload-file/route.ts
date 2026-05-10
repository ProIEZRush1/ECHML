export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { verifyAnyAuth } from "@/lib/api-auth";
import { getOpenAIKey } from "@/lib/openai/client";

export async function POST(request: NextRequest) {
  const user = await verifyAnyAuth(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const apiKey = await getOpenAIKey();
  if (!apiKey) {
    return NextResponse.json({ error: "No hay API key de OpenAI configurada" }, { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as Blob | null;
    const purpose = (formData.get("purpose") as string) || "batch";

    if (!file) {
      return NextResponse.json({ error: "file es requerido" }, { status: 400 });
    }

    const openaiForm = new FormData();
    openaiForm.append("file", file);
    openaiForm.append("purpose", purpose);

    const res = await fetch("https://api.openai.com/v1/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: openaiForm,
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `OpenAI error ${res.status}: ${errorBody}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
