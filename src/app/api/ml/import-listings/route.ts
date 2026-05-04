/**
 * API route for importing/syncing MercadoLibre listings.
 *
 * POST: Fetches seller items from ML API and upserts them in the database.
 *       Falls back to "demo mode" (returns existing DB listings) if no valid token.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";
import {
  getMLCredentials,
  hasValidToken,
  getSellerItems,
  getItemDetails,
} from "@/lib/ml/client";

export async function POST(): Promise<NextResponse> {
  const session = await verifySession();
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

    // Check if we have a valid token for real API calls
    const tokenValid = await hasValidToken();

    if (!tokenValid) {
      // Demo mode: return existing listings from DB
      const listings = await prisma.mLListing.findMany({
        include: {
          pack: { select: { sku: true, name: true, stock: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({
        mode: "local",
        message: "Token no valido. Mostrando datos locales.",
        listings,
        syncedAt: new Date().toISOString(),
      });
    }

    // Real API mode: fetch from ML
    const userId = credentials.mlUserId.toString();
    const itemIds = await getSellerItems(userId);

    if (itemIds.length === 0) {
      return NextResponse.json({
        mode: "api",
        message: "No se encontraron publicaciones en MercadoLibre",
        listings: [],
        syncedAt: new Date().toISOString(),
      });
    }

    // Fetch item details in batches
    const items = await getItemDetails(itemIds);

    // Upsert listings - we need to match to existing packs by ML item ID
    const upsertedListings = [];

    for (const item of items) {
      const statusMap: Record<string, string> = {
        active: "ACTIVE",
        paused: "PAUSED",
        closed: "CLOSED",
        under_review: "UNDER_REVIEW",
      };

      const mappedStatus = statusMap[item.status] || "ACTIVE";

      // Try to find an existing listing
      const existingListing = await prisma.mLListing.findUnique({
        where: { mlItemId: item.id },
      });

      if (existingListing) {
        // Update existing listing
        const updated = await prisma.mLListing.update({
          where: { mlItemId: item.id },
          data: {
            title: item.title,
            permalink: item.permalink,
            status: mappedStatus as "ACTIVE" | "PAUSED" | "CLOSED" | "UNDER_REVIEW",
            currentStock: item.available_quantity,
            currentPrice: item.price,
            lastSyncedAt: new Date(),
          },
          include: {
            pack: { select: { sku: true, name: true, stock: true } },
          },
        });
        upsertedListings.push(updated);
      }
      // Note: We don't create new listings without a pack association.
      // New items from ML that aren't linked to packs are skipped.
    }

    return NextResponse.json({
      mode: "api",
      message: `Se sincronizaron ${upsertedListings.length} publicaciones`,
      listings: upsertedListings,
      totalFound: itemIds.length,
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
