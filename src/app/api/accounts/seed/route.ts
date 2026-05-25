export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAnyAuth } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const existing = await prisma.account.count();
  if (existing > 0) return NextResponse.json({ message: "Accounts already seeded", count: existing });

  const accounts = await prisma.$transaction(async (tx) => {
    const mp = await tx.account.create({ data: { name: "Mercado Pago", color: "#22c55e", isDefault: true } });
    const nu = await tx.account.create({ data: { name: "NU Eduardo", color: "#8b5cf6" } });
    const banorte = await tx.account.create({ data: { name: "Banorte Eduardo", color: "#ef4444" } });
    const klar = await tx.account.create({ data: { name: "Klar Eduardo", color: "#3b82f6" } });

    const expenses = await tx.expense.findMany({ select: { id: true, concept: true } });
    for (const exp of expenses) {
      const c = exp.concept.toLowerCase();
      let accountId = mp.id;
      if (c.includes("uber")) accountId = nu.id;
      else if (c.includes("bolsas") || c.includes("durex")) accountId = banorte.id;
      else if (c.includes("playeras") || c.includes("camisas")) accountId = klar.id;
      await tx.expense.update({ where: { id: exp.id }, data: { accountId } });
    }

    await tx.withdrawal.updateMany({ data: { accountId: mp.id } });

    return { mp, nu, banorte, klar };
  });

  return NextResponse.json({ seeded: true, accounts: Object.keys(accounts).length });
}
