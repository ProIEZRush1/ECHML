import { NextRequest, NextResponse } from "next/server";
import { verifyAnyAuth } from "@/lib/api-auth";
import { getMLCredentials, mlFetch } from "@/lib/ml/client";

export const dynamic = "force-dynamic";

interface ProxyRequestBody {
  method: "GET" | "POST" | "PUT" | "DELETE";
  endpoint: string;
  body?: unknown;
}

/**
 * POST /api/ml/proxy
 *
 * Proxies any MercadoLibre API call using the stored access token.
 * Automatically injects the ML userId for endpoints that need it
 * (e.g. /orders/search, /users/me/items, /messages/packs).
 */
export async function POST(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const { method, endpoint, body } = (await request.json()) as ProxyRequestBody;

    if (!method || !endpoint) {
      return NextResponse.json(
        { error: "Se requieren 'method' y 'endpoint'" },
        { status: 400 }
      );
    }

    const credentials = await getMLCredentials();
    if (!credentials) {
      return NextResponse.json(
        { error: "No hay credenciales de MercadoLibre configuradas" },
        { status: 400 }
      );
    }

    const userId = credentials.mlUserId.toString();

    // Auto-inject userId into endpoints that use {userId} placeholder
    const resolvedEndpoint = endpoint.replace(/\{userId\}/g, userId);

    const fetchOptions: RequestInit = { method };

    if (body && (method === "POST" || method === "PUT")) {
      fetchOptions.body = JSON.stringify(body);
    }

    const data = await mlFetch(resolvedEndpoint, fetchOptions);

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    console.error("ML Proxy error:", message);

    const status = message.includes("ML API error")
      ? parseInt(message.match(/ML API error (\d+)/)?.[1] || "500", 10)
      : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
