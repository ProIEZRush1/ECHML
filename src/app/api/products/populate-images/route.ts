import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAnyAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/products/populate-images
 *
 * One-time utility: for each Product without an imageUrl, finds the first
 * linked Pack image via Product -> ProductVariant -> PackItem -> Pack.imageUrl
 * and copies it to Product.imageUrl.
 */
export async function POST(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const productsWithoutImage = await prisma.product.findMany({
    where: { imageUrl: null },
    select: {
      id: true,
      name: true,
      variants: {
        select: {
          packItems: {
            select: {
              pack: { select: { imageUrl: true } },
            },
          },
        },
      },
    },
  });

  let updated = 0;
  const results: { id: string; name: string; imageUrl: string }[] = [];

  for (const product of productsWithoutImage) {
    let imageUrl: string | null = null;

    for (const variant of product.variants) {
      for (const packItem of variant.packItems) {
        if (packItem.pack.imageUrl) {
          imageUrl = packItem.pack.imageUrl;
          break;
        }
      }
      if (imageUrl) break;
    }

    if (imageUrl) {
      await prisma.product.update({
        where: { id: product.id },
        data: { imageUrl },
      });
      updated++;
      results.push({ id: product.id, name: product.name, imageUrl });
    }
  }

  return NextResponse.json({
    message: `Imagenes actualizadas: ${updated} de ${productsWithoutImage.length} productos sin imagen`,
    updated,
    total: productsWithoutImage.length,
    results,
  });
}
