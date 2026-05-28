import { NextRequest, NextResponse } from "next/server";
import { verifyAnyAuth } from "@/lib/api-auth";
import { openaiRequest } from "@/lib/openai/client";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `Eres un asistente que extrae datos de facturas mexicanas (CFDI) a partir del contenido de un PDF.

Extrae los siguientes campos y devuelve SOLAMENTE un JSON válido (sin markdown, sin texto adicional):

{
  "folio": "string o null - número de folio/serie de la factura",
  "rfcEmisor": "string o null - RFC del emisor",
  "rfcReceptor": "string o null - RFC del receptor",
  "fechaEmision": "string ISO 8601 o null - fecha de emisión (YYYY-MM-DD)",
  "subtotal": "number o null - subtotal antes de IVA",
  "iva": "number o null - monto del IVA",
  "total": "number o null - total de la factura",
  "conceptos": [
    {
      "descripcion": "string - descripción del concepto",
      "cantidad": "number - cantidad",
      "unitario": "number - precio unitario",
      "importe": "number - importe del concepto"
    }
  ]
}

Si no puedes extraer algún campo, usa null. Los conceptos deben ser un array (vacío si no se encuentran).
Asegúrate de que los montos sean números, no strings.`;

export async function POST(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { pdfBase64 } = body;

    if (!pdfBase64 || typeof pdfBase64 !== "string") {
      return NextResponse.json(
        { error: "pdfBase64 es requerido" },
        { status: 400 }
      );
    }

    const response = await openaiRequest<{
      choices: Array<{ message: { content: string } }>;
    }>("/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "file",
                file: {
                  filename: "factura.pdf",
                  file_data: `data:application/pdf;base64,${pdfBase64}`,
                },
              },
              {
                type: "text",
                text: "Extrae los datos de esta factura y devuelve el JSON.",
              },
            ],
          },
        ],
        temperature: 0,
        max_tokens: 2000,
      }),
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "No se recibió respuesta de OpenAI" },
        { status: 500 }
      );
    }

    // Parse the JSON from the response, handling potential markdown wrapping
    let extracted: unknown;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      extracted = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "No se pudo parsear la respuesta de OpenAI", raw: content },
        { status: 500 }
      );
    }

    return NextResponse.json(extracted);
  } catch (error: unknown) {
    console.error("Error al extraer factura:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
