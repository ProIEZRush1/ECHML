import { NextRequest, NextResponse } from "next/server";
import { verifyAnyAuth } from "@/lib/api-auth";
import { uploadTikTokImage, uploadTikTokImageData } from "@/lib/tiktok/client";

export const dynamic = "force-dynamic";

/**
 * POST /api/tiktok/upload-picture
 *
 * Two modes:
 *  - JSON  { imageUrl, useCase?, filename? }  — server fetches the URL then uploads.
 *  - multipart/form-data { file, useCase? }   — raw bytes uploaded directly
 *    (use this when the source CDN blocks the datacenter IP, e.g. ML Cloudflare).
 *
 * Returns { uri, url }; reference uri as an image id when creating products.
 * useCase: MAIN_IMAGE (default) | ATTRIBUTE_IMAGE | DESCRIPTION_IMAGE |
 *          CERTIFICATION_IMAGE | SIZE_CHART_IMAGE
 */
export async function POST(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file") as File | null;
      const useCase = (form.get("useCase") as string) || "MAIN_IMAGE";
      if (!file) {
        return NextResponse.json({ error: "Se requiere 'file'" }, { status: 400 });
      }
      const bytes = await file.arrayBuffer();
      const result = await uploadTikTokImageData(bytes, file.name || "image.jpg", useCase);
      return NextResponse.json(result);
    }

    const { imageUrl, useCase, filename } = (await request.json()) as {
      imageUrl?: string;
      useCase?: string;
      filename?: string;
    };

    if (!imageUrl) {
      return NextResponse.json({ error: "Se requiere 'imageUrl' o 'file'" }, { status: 400 });
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
    const raw = message.includes("TikTok API error")
      ? parseInt(message.match(/TikTok API error (\d+)/)?.[1] || "400", 10)
      : 500;
    const status = raw >= 200 && raw <= 599 ? raw : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
