export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { verifyAnyAuth } from "@/lib/api-auth";
import { sendEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const to = (body as { to?: string }).to || "edumaucherni@gmail.com";

    const result = await sendEmail(
      to,
      "ECH CRM - Test Email",
      `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">ECH CRM</h2>
        <p>Email configurado correctamente.</p>
        <p style="color: #6b7280; font-size: 14px;">Enviado desde echml.overcloud.us</p>
      </div>`
    );

    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
