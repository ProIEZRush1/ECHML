import { NextRequest, NextResponse } from "next/server";
import { verifyAnyAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { computeReconciliation } from "@/lib/finance/reconciliation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    // Correct identity: sale.balanceChange is ALREADY net of comisión+envío, so we must NOT
    // subtract the fee/shipping debit rows again (the old Σcredits − Σ|debits| double-counted them).
    const recon = await computeReconciliation();

    return NextResponse.json({
      totalIncome: recon.ventasBrutas,
      totalNetSales: recon.ventasNetas,
      totalFees: recon.comisiones + recon.envios,
      flexNeto: recon.flexNeto,
      gastosDesdeMP: recon.gastosDesdeMP,
      totalWithdrawn: recon.retiros,
      estimatedBalance: recon.saldoLibros,
      realBalance: recon.real,
      diferencia: recon.diferencia,
      lastSync: (await prisma.mPTransaction.findFirst({
        orderBy: { syncedAt: "desc" },
        select: { syncedAt: true },
      }))?.syncedAt ?? null,
    });
  } catch (error: unknown) {
    console.error("Error al obtener balance:", error);
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
