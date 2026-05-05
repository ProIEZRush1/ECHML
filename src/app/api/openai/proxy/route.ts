export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { verifyAnyAuth } from "@/lib/api-auth";
import { openaiRequest, getOpenAIKey } from "@/lib/openai/client";

export async function POST(request: NextRequest) {
  const user = await verifyAnyAuth(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await request.json();
    const { method = "POST", endpoint, payload } = body;

    if (!endpoint || typeof endpoint !== "string") {
      return NextResponse.json({ error: "endpoint es requerido" }, { status: 400 });
    }

    // File upload requires special handling
    if (endpoint === "/files" && payload?.content) {
      const apiKey = await getOpenAIKey();
      if (!apiKey) {
        return NextResponse.json({ error: "No hay API key de OpenAI configurada" }, { status: 400 });
      }

      const blob = new Blob([payload.content], { type: "application/jsonl" });
      const formData = new FormData();
      formData.append("file", blob, payload.filename || "batch.jsonl");
      formData.append("purpose", payload.purpose || "batch");

      const res = await fetch("https://api.openai.com/v1/files", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
      });

      if (!res.ok) {
        const errorBody = await res.text().catch(() => "");
        throw new Error(`OpenAI API error ${res.status}: ${errorBody}`);
      }

      const data = await res.json();
      return NextResponse.json(data);
    }

    const options: RequestInit = { method };
    if (payload && (method === "POST" || method === "PUT" || method === "PATCH")) {
      options.headers = { "Content-Type": "application/json" };
      options.body = JSON.stringify(payload);
    }

    const data = await openaiRequest(endpoint, options);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
