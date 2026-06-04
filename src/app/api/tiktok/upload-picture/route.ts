import { NextRequest, NextResponse } from "next/server";
import { verifyAnyAuth } from "@/lib/api-auth";
import { uploadTikTokImage } from "@/lib/tiktok/client";

export const dynamic = "force-dynamic";

/**
 * POST /api/tiktok/upload-picture
 *
 * Body: { imageUrl: string, useCase?: string, filename?: string }
 * Fetches the source image (e.g. a hi-res MercadoLibre photo) and uploads it
 * to TikTok Shop, returning the { uri, url } so the uri can be referenced as an
 * image id when creating/updating products.
 *
 * useCase: MAIN_IMAGE (default) | ATTRIBUTE_IMAGE | DESCRIPTION_IMAGE |
 *          CERTIFICATION_IMAGE | SIZE_CHART_IMAGE
 */
export async function POST(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const { imageUrl, useCase, filename } = (await request.json()) as {
      imageUrl?: string;
      useCase?: string;
      filename?: string;
    };

    if (!imageUrl) {
      return NextResponse.json({ error: "Se requiere 'imageUrl'" }, { status: 400 });
    }

    const result = await uploadTikTokImage(
      imageUrl,
      filename || "image.jpg",
      useCase || "MAIN_IMAGE"
    );

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    console.error("TikTok upload-picture error:", message);
    const status = message.includes("TikTok API error")
      ? parseInt(message.match(/TikTok API error (\d+)/)?.[1] || "500", 10)
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
