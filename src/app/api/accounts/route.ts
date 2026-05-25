export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { verifyAnyAuth } from "@/lib/api-auth";

const createSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
  isDefault: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const accounts = await prisma.account.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { expenses: true, withdrawalsFrom: true, withdrawalsTo: true } },
    },
  });

  return NextResponse.json(accounts);
}

export async function POST(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await request.json();
  const result = createSchema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });

  const account = await prisma.account.create({
    data: {
      name: result.data.name,
      color: result.data.color || "#6b7280",
      isDefault: result.data.isDefault || false,
    },
  });

  return NextResponse.json(account, { status: 201 });
}
