import { NextRequest, NextResponse } from "next/server";
import { verifyAnyAuth } from "@/lib/api-auth";
import { tiktokFetch } from "@/lib/tiktok/client";

export const dynamic = "force-dynamic";

interface ProxyRequestBody {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
  params?: Record<string, string>;
  skipShopCipher?: boolean;
}

export async function POST(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const { method, path, body, params, skipShopCipher } =
      (await request.json()) as ProxyRequestBody;

    if (!method || !path) {
      return NextResponse.json(
        { error: "Se requieren 'method' y 'path'" },
        { status: 400 }
      );
    }

    const data = await tiktokFetch(path, {
      method,
      body,
      params,
      skipShopCipher,
    });

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    console.error("TikTok Proxy error:", message);

    // The number after "TikTok API error" is TikTok's error *code* (e.g.
    // 36009004), NOT an HTTP status — using it directly throws a RangeError
    // (status must be 200-599) and crashes into a bare 500 that hides the real
    // message. Surface TikTok errors as 400 so the message reaches the caller.
    const raw = message.includes("TikTok API error")
      ? parseInt(message.match(/TikTok API error (\d+)/)?.[1] || "400", 10)
      : 500;
    const status = raw >= 200 && raw <= 599 ? raw : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
