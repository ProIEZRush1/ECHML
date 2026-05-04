import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAnyAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const label = searchParams.get("label");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const packId = searchParams.get("packId");
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const where: Record<string, unknown> = {};

    if (label) {
      where.label = label;
    }
    if (packId) {
      where.packId = packId;
    }
    if (dateFrom || dateTo) {
      where.dateCreated = {};
      if (dateFrom) {
        (where.dateCreated as Record<string, unknown>).gte = new Date(dateFrom);
      }
      if (dateTo) {
        (where.dateCreated as Record<string, unknown>).lte = new Date(dateTo);
      }
    }

    const [transactions, total] = await Promise.all([
      prisma.mPTransaction.findMany({
        where,
        include: {
          pack: {
            select: { id: true, sku: true, name: true },
          },
        },
        orderBy: { dateCreated: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.mPTransaction.count({ where }),
    ]);

    // Serialize BigInt fields to string for JSON
    const serialized = transactions.map((tx) => ({
      ...tx,
      mpId: tx.mpId.toString(),
      mlOrderId: tx.mlOrderId?.toString() || null,
      amount: Number(tx.amount),
      balanceChange: Number(tx.balanceChange),
    }));

    return NextResponse.json({
      transactions: serialized,
      paging: { total, offset, limit },
    });
  } catch (error: unknown) {
    console.error("Error al listar transacciones MP:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
