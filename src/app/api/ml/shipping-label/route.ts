export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { verifyAnyAuth } from "@/lib/api-auth";
import { getMLCredentials, refreshAccessToken } from "@/lib/ml/client";
import { PDFDocument } from "pdf-lib";

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

async function fetchLabelPdf(shipmentIds: string, token: string): Promise<ArrayBuffer | null> {
  const res = await fetch(
    `${ML_API}/shipment_labels?shipment_ids=${shipmentIds}&response_type=pdf`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  return res.arrayBuffer();
}

export async function GET(request: NextRequest) {
  const user = await verifyAnyAuth(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const shipmentId = request.nextUrl.searchParams.get("shipmentId");
  const shipmentIds = request.nextUrl.searchParams.get("shipmentIds");
  const layout = request.nextUrl.searchParams.get("layout");
  const ids = shipmentIds || shipmentId;

  if (!ids) {
    return NextResponse.json({ error: "Falta shipmentId o shipmentIds" }, { status: 400 });
  }

  const token = await getToken();
  if (!token) {
    return NextResponse.json({ error: "No hay token ML valido" }, { status: 401 });
  }

  if (layout === "single") {
    const idList = ids.split(",").filter(Boolean);
    const labelPages: { src: PDFDocument; idx: number }[] = [];
    const contentPages: { src: PDFDocument; idx: number }[] = [];

    const batchSize = 5;
    for (let i = 0; i < idList.length; i += batchSize) {
      const batch = idList.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map((id) => fetchLabelPdf(id, token))
      );
      for (const pdfBytes of results) {
        if (!pdfBytes) continue;
        const src = await PDFDocument.load(pdfBytes);
        const pageCount = src.getPageCount();
        labelPages.push({ src, idx: 0 });
        for (let p = 1; p < pageCount; p++) {
          contentPages.push({ src, idx: p });
        }
      }
    }

    const merged = await PDFDocument.create();
    for (const { src, idx } of labelPages) {
      const [page] = await merged.copyPages(src, [idx]);
      merged.addPage(page);
    }
    for (const { src, idx } of contentPages) {
      const [page] = await merged.copyPages(src, [idx]);
      merged.addPage(page);
    }

    const mergedBytes = await merged.save();
    return new NextResponse(Buffer.from(mergedBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="etiquetas-individual.pdf"`,
      },
    });
  }

  const pdf = await fetchLabelPdf(ids, token);
  if (!pdf) {
    return NextResponse.json(
      { error: "Error al obtener etiqueta" },
      { status: 500 }
    );
  }

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="etiquetas.pdf"`,
    },
  });
}
