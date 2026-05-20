export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { verifyAnyAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

async function ensureToken(): Promise<string> {
  const cred = await prisma.mLCredential.findFirst();
  if (!cred) throw new Error("No ML credentials");
  if (cred.tokenExpiresAt > new Date()) return cred.accessToken;

  const res = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: cred.appId,
      client_secret: cred.clientSecret,
      refresh_token: cred.refreshToken,
    }),
  });
  if (!res.ok) throw new Error("Token refresh failed");
  const data = await res.json();

  await prisma.mLCredential.update({
    where: { id: cred.id },
    data: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
    },
  });

  return data.access_token;
}

export async function POST(request: NextRequest) {
  const user = await verifyAnyAuth(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const itemId = formData.get("itemId") as string | null;

  if (!file || !itemId) {
    return NextResponse.json({ error: "file and itemId required" }, { status: 400 });
  }

  const token = await ensureToken();

  const mlForm = new FormData();
  mlForm.append("file", file);

  const uploadRes = await fetch(
    `https://api.mercadolibre.com/items/${itemId}/video`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: mlForm,
    }
  );

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    return NextResponse.json({ error: `ML video upload failed: ${err}` }, { status: uploadRes.status });
  }

  const result = await uploadRes.json();
  return NextResponse.json(result);
}
