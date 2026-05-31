export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { verifyAnyAuth } from "@/lib/api-auth";
import { backfillOrdersRange } from "@/lib/mp/client";

// POST /api/orders/backfill-range?from=YYYY-MM-DD&to=YYYY-MM-DD
// Matches every ML paid order in the range into MPTransaction (real paid amount) + MLOrder.
export async function POST(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.get("from") || "") ? sp.get("from")! : null;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(sp.get("to") || "") ? sp.get("to")! : null;
  if (!from || !to) return NextResponse.json({ error: "from/to requeridos (YYYY-MM-DD)" }, { status: 400 });

  try {
    const result = await backfillOrdersRange(from, to);
    return NextResponse.json({ range: { from, to }, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
