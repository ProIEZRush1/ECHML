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

    const LABEL_W = 283.46; // 100mm in points
    const LABEL_H = 425.20; // 150mm in points

    const merged = await PDFDocument.create();

    for (const pdfBytes of individualResults) {
      if (!pdfBytes) continue;
      const src = await PDFDocument.load(pdfBytes);
      const srcPage = src.getPage(0);
      const { width: srcW, height: srcH } = srcPage.getSize();

      // Clip to label content area (top portion of ML page), then stretch to fill thermal label
      const contentW = Math.min(srcW, 420);
      const contentH = Math.min(srcH, 560);
      const clipRect = { left: 0, bottom: srcH - contentH, right: contentW, top: srcH };

      const embedded = await merged.embedPage(srcPage, clipRect);
      const page = merged.addPage([LABEL_W, LABEL_H]);
      page.drawPage(embedded, { x: 0, y: 0, width: LABEL_W, height: LABEL_H });
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
