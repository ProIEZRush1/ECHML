export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAnyAuth } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const deleted = await prisma.mPTransaction.deleteMany({
      where: { label: "flex_cost" },
    });

    return NextResponse.json({
      message: `Deleted ${deleted.count} incorrect flex_cost transactions`,
      deletedFlexCost: deleted.count,
    });
  } catch (error: unknown) {
    console.error("Fix shipping error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
