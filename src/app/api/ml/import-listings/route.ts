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

function generateSku(mlItemId: string): string {
  return `ML-${mlItemId.replace("MLM", "")}`;
}

function shortenTitle(title: string): string {
  return title.length > 80 ? title.substring(0, 77) + "..." : title;
}

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
      const count = await prisma.mLListing.count();
      return NextResponse.json({
        mode: "local",
        message: "Token no valido. Mostrando datos locales.",
        count,
      });
    }

    const userId = credentials.mlUserId.toString();
    const itemIds = await getSellerItems(userId);

    if (itemIds.length === 0) {
      return NextResponse.json({
        mode: "api",
        message: "No se encontraron publicaciones en MercadoLibre",
        count: 0,
      });
    }

    const items = await getItemDetails(itemIds);

    let created = 0;
    let updated = 0;
    let packsCreated = 0;

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
        // Auto-create a pack for this listing
        const sku = generateSku(item.id);
        let pack = await prisma.pack.findUnique({ where: { sku } });

        if (!pack) {
          pack = await prisma.pack.create({
            data: {
              sku,
              name: shortenTitle(item.title),
              salePrice: item.price || 0,
              stock: item.available_quantity || 0,
              description: `Auto-importado de ML: ${item.id}`,
            },
          });
          packsCreated++;
        }

        await prisma.mLListing.create({
          data: {
            mlItemId: item.id,
            packId: pack.id,
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

    // Also reassign any listings currently on "Sin Asignar" pack
    const sinAsignar = await prisma.pack.findUnique({
      where: { sku: "SIN-ASIGNAR" },
    });
    if (sinAsignar) {
      const unassigned = await prisma.mLListing.findMany({
        where: { packId: sinAsignar.id },
      });

      for (const listing of unassigned) {
        const sku = generateSku(listing.mlItemId);
        let pack = await prisma.pack.findUnique({ where: { sku } });

        if (!pack) {
          pack = await prisma.pack.create({
            data: {
              sku,
              name: shortenTitle(listing.title || listing.mlItemId),
              salePrice: listing.currentPrice || 0,
              stock: listing.currentStock || 0,
              description: `Auto-importado de ML: ${listing.mlItemId}`,
            },
          });
          packsCreated++;
        }

        await prisma.mLListing.update({
          where: { id: listing.id },
          data: { packId: pack.id },
        });
      }

      // Delete the empty Sin Asignar pack
      const remaining = await prisma.mLListing.count({
        where: { packId: sinAsignar.id },
      });
      if (remaining === 0) {
        await prisma.pack.delete({ where: { id: sinAsignar.id } });
      }
    }

    return NextResponse.json({
      mode: "api",
      message: `Sincronizacion completa: ${created} nuevas, ${updated} actualizadas, ${packsCreated} packs creados de ${itemIds.length} publicaciones`,
      count: itemIds.length,
      created,
      updated,
      packsCreated,
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
