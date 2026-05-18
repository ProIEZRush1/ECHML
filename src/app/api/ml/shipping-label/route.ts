export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { verifyAnyAuth } from "@/lib/api-auth";
import { getMLCredentials, refreshAccessToken } from "@/lib/ml/client";

const ML_API = "https://api.mercadolibre.com";

async function getToken(): Promise<string | null> {
  const creds = await getMLCredentials();
  if (!creds) return null;
  if (new Date(creds.tokenExpiresAt) < new Date()) {
    const ok = await refreshAccessToken();
    if (!ok) return null;
    const refreshed = await getMLCredentials();
    return refreshed?.accessToken || null;
  }
  return creds.accessToken;
}

export async function GET(request: NextRequest) {
  const user = await verifyAnyAuth(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const shipmentId = request.nextUrl.searchParams.get("shipmentId");
  const shipmentIds = request.nextUrl.searchParams.get("shipmentIds");
  const ids = shipmentIds || shipmentId;

  if (!ids) {
    return NextResponse.json({ error: "Falta shipmentId o shipmentIds" }, { status: 400 });
  }

  const token = await getToken();
  if (!token) {
    return NextResponse.json({ error: "No hay token ML valido" }, { status: 401 });
  }

  const res = await fetch(
    `${ML_API}/shipment_labels?shipment_ids=${ids}&response_type=pdf`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { error: "Error al obtener etiqueta", detail: text },
      { status: res.status }
    );
  }

  const pdf = await res.arrayBuffer();
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="etiquetas.pdf"`,
    },
  });
}
