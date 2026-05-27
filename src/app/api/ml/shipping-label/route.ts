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
    const LABEL_MAX_H = 425.20; // 150mm in points

    const merged = await PDFDocument.create();

    for (const pdfBytes of individualResults) {
      if (!pdfBytes) continue;
      const src = await PDFDocument.load(pdfBytes);
      const srcPage = src.getPage(0);
      const { width: srcW, height: srcH } = srcPage.getSize();

      // Use TrimBox/CropBox if available, else estimate content area
      const trimBox = srcPage.getTrimBox();
      const cropBox = srcPage.getCropBox();
      const box = (trimBox.width > 0 && trimBox.width < srcW) ? trimBox :
                  (cropBox.width > 0 && cropBox.width < srcW) ? cropBox : null;

      let contentW: number, contentH: number, clipLeft: number, clipBottom: number;
      if (box) {
        contentW = box.width;
        contentH = box.height;
        clipLeft = box.x;
        clipBottom = box.y;
      } else {
        // Heuristic: content is left ~55% width, top ~65% height of a letter page
        contentW = Math.min(srcW, srcW * 0.58);
        contentH = Math.min(srcH, srcH * 0.68);
        clipLeft = 0;
        clipBottom = srcH - contentH;
      }

      const clipRect = { left: clipLeft, bottom: clipBottom, right: clipLeft + contentW, top: clipBottom + contentH };
      const embedded = await merged.embedPage(srcPage, clipRect);

      // Scale to 100mm width, proportional height capped at 150mm
      const scale = LABEL_W / contentW;
      const scaledH = Math.min(contentH * scale, LABEL_MAX_H);
      const pageH = Math.max(scaledH, LABEL_MAX_H);

      const page = merged.addPage([LABEL_W, pageH]);
      page.drawPage(embedded, { x: 0, y: pageH - scaledH, width: LABEL_W, height: scaledH });
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
