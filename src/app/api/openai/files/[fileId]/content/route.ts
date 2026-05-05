export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { verifyAnyAuth } from "@/lib/api-auth";
import { getOpenAIKey } from "@/lib/openai/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const user = await verifyAnyAuth(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { fileId } = await params;
  const apiKey = await getOpenAIKey();
  if (!apiKey) {
    return NextResponse.json({ error: "No hay API key de OpenAI configurada" }, { status: 400 });
  }

  const res = await fetch(`https://api.openai.com/v1/files/${fileId}/content`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `OpenAI error ${res.status}: ${errorBody}` },
      { status: res.status }
    );
  }

  return new NextResponse(res.body, {
    headers: {
      "Content-Type": res.headers.get("content-type") || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${fileId}.jsonl"`,
    },
  });
}
