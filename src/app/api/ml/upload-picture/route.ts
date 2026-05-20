import { NextRequest, NextResponse } from "next/server";
import { verifyAnyAuth } from "@/lib/api-auth";
import { getMLCredentials, refreshAccessToken } from "@/lib/ml/client";

export const dynamic = "force-dynamic";

const ML_API_BASE = "https://api.mercadolibre.com";

async function getValidToken(): Promise<string | null> {
  const cred = await getMLCredentials();
  if (!cred) return null;

  if (cred.accessToken && cred.tokenExpiresAt > new Date(Date.now() + 60000)) {
    return cred.accessToken;
  }

  if (cred.refreshToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const updated = await getMLCredentials();
      return updated?.accessToken || null;
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const itemId = formData.get("itemId") as string | null;
    const uploadType = formData.get("type") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "Se requiere un archivo 'file'" },
        { status: 400 }
      );
    }

    const token = await getValidToken();
    if (!token) {
      return NextResponse.json(
        { error: "No hay token valido de MercadoLibre" },
        { status: 400 }
      );
    }

    const mlForm = new FormData();
    mlForm.append("file", file, file.name);

    let url: string;
    if (uploadType === "clip" && itemId) {
      url = `${ML_API_BASE}/marketplace/items/${itemId}/clips/upload`;
      const sites = formData.get("sites") as string | null;
      if (sites) mlForm.append("sites", sites);
    } else if (uploadType === "video" && itemId) {
      url = `${ML_API_BASE}/items/${itemId}/video`;
    } else {
      url = `${ML_API_BASE}/pictures/items/upload`;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: mlForm,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return NextResponse.json(
        { error: `ML API error ${response.status}: ${errorBody}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    console.error("ML upload error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
