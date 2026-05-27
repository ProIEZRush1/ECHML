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

    const [individualResults, bulkPdf] = await Promise.all([
      Promise.all(idList.map((id) => fetchLabelPdf(id, token))),
      fetchLabelPdf(ids, token),
    ]);

    // ML labels: A4 landscape (841.89 × 595.28 pt), label is 90×149mm box at top-left
    // Crop margins: left 11mm, top 10mm, right 196mm, bottom 51mm
    const CROP_LEFT = 31.18;   // 11mm
    const CROP_BOTTOM = 144.57; // 51mm from bottom
    const CROP_W = 255.12;     // 90mm
    const CROP_H = 422.36;     // 149mm

    const merged = await PDFDocument.create();

    for (const pdfBytes of individualResults) {
      if (!pdfBytes) continue;
      const src = await PDFDocument.load(pdfBytes);
      const [copiedPage] = await merged.copyPages(src, [0]);
      copiedPage.setCropBox(CROP_LEFT, CROP_BOTTOM, CROP_W, CROP_H);
      copiedPage.setMediaBox(CROP_LEFT, CROP_BOTTOM, CROP_W, CROP_H);
      merged.addPage(copiedPage);
    }

    if (bulkPdf) {
      const bulkDoc = await PDFDocument.load(bulkPdf);
      const totalPages = bulkDoc.getPageCount();
      const labelPageCount = Math.ceil(idList.length / 3);
      if (totalPages > labelPageCount) {
        const contentIndices = Array.from(
          { length: totalPages - labelPageCount },
          (_, i) => labelPageCount + i
        );
        const contentPages = await merged.copyPages(bulkDoc, contentIndices);
        for (const page of contentPages) merged.addPage(page);
      }
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
