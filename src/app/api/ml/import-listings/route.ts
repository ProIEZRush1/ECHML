import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAnyAuth } from "@/lib/api-auth";
import {
  getMLCredentials,
  hasValidToken,
  getSellerItems,
  getItemDetails,
} from "@/lib/ml/client";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const credentials = await getMLCredentials();
    if (!credentials) {
      return NextResponse.json(
        { error: "No hay credenciales de MercadoLibre configuradas" },
        { status: 400 }
      );
    }

    const tokenValid = await hasValidToken();
    if (!tokenValid) {
      const listings = await prisma.mLListing.findMany({
        include: { pack: { select: { sku: true, name: true, stock: true } } },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({
        mode: "local",
        message: "Token no valido. Mostrando datos locales.",
        count: listings.length,
        syncedAt: new Date().toISOString(),
      });
    }

    const userId = credentials.mlUserId.toString();
    const itemIds = await getSellerItems(userId);

    if (itemIds.length === 0) {
      return NextResponse.json({
        mode: "api",
        message: "No se encontraron publicaciones en MercadoLibre",
        count: 0,
        syncedAt: new Date().toISOString(),
      });
    }

    const items = await getItemDetails(itemIds);

    let created = 0;
    let updated = 0;

    // Create a default "Sin Asignar" pack for unlinked listings
    let defaultPack = await prisma.pack.findUnique({
      where: { sku: "SIN-ASIGNAR" },
    });
    if (!defaultPack) {
      defaultPack = await prisma.pack.create({
        data: {
          sku: "SIN-ASIGNAR",
          name: "Sin Asignar",
          salePrice: 0,
          stock: 0,
          description: "Publicaciones importadas de ML sin pack asignado",
        },
      });
    }

    for (const item of items) {
      const statusMap: Record<string, string> = {
        active: "ACTIVE",
        paused: "PAUSED",
        closed: "CLOSED",
        under_review: "UNDER_REVIEW",
      };
      const mappedStatus = (statusMap[item.status] || "ACTIVE") as
        | "ACTIVE"
        | "PAUSED"
        | "CLOSED"
        | "UNDER_REVIEW";

      const existing = await prisma.mLListing.findUnique({
        where: { mlItemId: item.id },
      });

      if (existing) {
        await prisma.mLListing.update({
          where: { mlItemId: item.id },
          data: {
            title: item.title,
            permalink: item.permalink,
            status: mappedStatus,
            currentStock: item.available_quantity,
            currentPrice: item.price,
            lastSyncedAt: new Date(),
          },
        });
        updated++;
      } else {
        await prisma.mLListing.create({
          data: {
            mlItemId: item.id,
            packId: defaultPack.id,
            title: item.title,
            permalink: item.permalink,
            status: mappedStatus,
            currentStock: item.available_quantity,
            currentPrice: item.price,
            lastSyncedAt: new Date(),
          },
        });
        created++;
      }
    }

    return NextResponse.json({
      mode: "api",
      message: `Sincronizacion completa: ${created} nuevas, ${updated} actualizadas de ${itemIds.length} publicaciones`,
      count: itemIds.length,
      created,
      updated,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error importing ML listings:", error);
    return NextResponse.json(
      {
        error: "Error al sincronizar publicaciones",
        details: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
