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

    const openaiForm = new FormData();

    const model = formData.get("model") as string || "gpt-image-2";
    const prompt = formData.get("prompt") as string;
    const size = formData.get("size") as string || "1024x1024";
    const quality = formData.get("quality") as string || "medium";
    const n = formData.get("n") as string || "1";

    if (!prompt) {
      return NextResponse.json({ error: "prompt es requerido" }, { status: 400 });
    }

    openaiForm.append("model", model);
    openaiForm.append("prompt", prompt);
    openaiForm.append("size", size);
    openaiForm.append("quality", quality);
    openaiForm.append("n", n);

    const images = formData.getAll("image");
    for (const image of images) {
      if (image instanceof Blob) {
        openaiForm.append("image", image);
      }
    }

    const res = await fetch("https://api.openai.com/v1/images/edits", {
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
