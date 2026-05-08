import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAnyAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

interface GroupSeed {
  name: string;
  color: string;
  getProductIds: () => Promise<string[]>;
}

export async function POST(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const existingGroups = await prisma.productGroup.findMany({
      select: { name: true },
    });
    const existingNames = new Set(existingGroups.map((g) => g.name));

    const groupSeeds: GroupSeed[] = [
      {
        name: "Magnesios Isaac",
        color: "#3b82f6",
        getProductIds: async () => {
          const products = await prisma.product.findMany({
            where: {
              brand: "NaturalSlim",
              NOT: {
                OR: [
                  { name: { contains: "Kadsorb" } },
                  { name: { contains: "Magicmag Polvo De Citrato De Magnesio Puro" } },
                ],
              },
            },
            select: { id: true },
          });
          return products.map((p) => p.id);
        },
      },
      {
        name: "Magnesios Eduardo",
        color: "#8b5cf6",
        getProductIds: async () => {
          const products = await prisma.product.findMany({
            where: {
              brand: "NaturalSlim",
              OR: [
                { name: { contains: "Kadsorb" } },
                { name: { contains: "Magicmag Polvo De Citrato De Magnesio Puro" } },
              ],
            },
            select: { id: true },
          });
          return products.map((p) => p.id);
        },
      },
      {
        name: "Bluemango",
        color: "#06b6d4",
        getProductIds: async () => {
          const products = await prisma.product.findMany({
            where: { brand: "Bluemango" },
            select: { id: true },
          });
          return products.map((p) => p.id);
        },
      },
      {
        name: "Timi's",
        color: "#f59e0b",
        getProductIds: async () => {
          const products = await prisma.product.findMany({
            where: {
              supplier: { name: { in: ["SUPLYADORNOS", "Timi's"] } },
            },
            select: { id: true },
          });
          return products.map((p) => p.id);
        },
      },
    ];

    const created: string[] = [];
    const skipped: string[] = [];

    for (const seed of groupSeeds) {
      if (existingNames.has(seed.name)) {
        skipped.push(seed.name);
        continue;
      }

      const productIds = await seed.getProductIds();
      if (productIds.length === 0) {
        skipped.push(`${seed.name} (sin productos)`);
        continue;
      }

      await prisma.productGroup.create({
        data: {
          name: seed.name,
          color: seed.color,
          items: {
            create: productIds.map((productId) => ({ productId })),
          },
        },
      });

      created.push(seed.name);
    }

    return NextResponse.json({
      message: "Seed completado",
      created,
      skipped,
    });
  } catch (error) {
    console.error("Error al hacer seed de grupos:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
