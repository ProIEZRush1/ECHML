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

interface MLItemData {
  id: string;
  title: string;
  catalog_product_id: string | null;
  attributes: Array<{ id: string; name: string; value_name: string | null }>;
  variations: Array<{
    id: number;
    attribute_combinations: Array<{ id: string; name: string; value_name: string }>;
  }>;
}

interface ProductGroupInfo {
  groupKey: string;
  productName: string;
  variantLabel: string;
  brand: string;
  skip: boolean;
}

function extractVariantFromML(item: MLItemData): string {
  // 1. Check variations (multi-variant items like Bluemango with colors)
  if (item.variations?.length > 0) {
    const v = item.variations[0];
    const labels = v.attribute_combinations
      ?.map((a) => a.value_name)
      .filter(Boolean);
    if (labels?.length > 0) return labels.join(" / ");
  }

  // 2. Check attributes for COLOR, FLAVOR, SIZE
  const variantAttrs = ["COLOR", "FLAVOR", "SIZE", "ALPHANUMERIC_SIZE"];
  for (const attrId of variantAttrs) {
    const attr = item.attributes?.find((a) => a.id === attrId);
    if (attr?.value_name) return attr.value_name;
  }

  // 3. Check SELLER_CUSTOM_FIELD or SELLER_SKU
  const sku = item.attributes?.find((a) => a.id === "SELLER_SKU");
  if (sku?.value_name) return sku.value_name;

  return "Default";
}

function extractBrandFromML(item: MLItemData): string {
  const brand = item.attributes?.find((a) => a.id === "BRAND");
  if (brand?.value_name) return brand.value_name;
  return item.title.split(/\s+/)[0] || "Generico";
}

function classifyListing(item: MLItemData): ProductGroupInfo {
  const t = item.title.toLowerCase();

  // Skip Timi's products (already in Products table)
  if (
    t.includes("timi") || t.includes("biberon") || t.includes("chupon") ||
    t.includes("sujetador") || t.includes("dispensador de leche") ||
    (t.includes("vaso") && t.includes("entrenador"))
  ) {
    return { groupKey: "", productName: "", variantLabel: "", brand: "", skip: true };
  }

  const variantLabel = extractVariantFromML(item);
  const brand = extractBrandFromML(item);

  // Brand-specific rules FIRST (override catalog_product_id grouping)

  // Bluemango — ALL are 1 product regardless of catalog_product_id
  if (t.includes("bluemango")) {
    return {
      groupKey: "bluemango-termo",
      productName: "Bluemango Termo Deportivo",
      variantLabel,
      brand: "Bluemango",
      skip: false,
    };
  }

  // NaturalSlim / Magimag — group by sub-product
  if (t.includes("magimag") || t.includes("magnesio") || t.includes("naturalslim")) {
    let productName = "Magimag Citrato de Magnesio";
    let groupKey = "naturalslim-other";

    if (t.includes("magimag") || t.includes("citrato")) {
      groupKey = "naturalslim-magimag-citrato";
      productName = "Magimag Citrato de Magnesio";
    } else if (t.includes("meta-b") || t.includes("proteina")) {
      groupKey = "naturalslim-meta-b";
      productName = "Meta-B Proteina NaturalSlim";
    } else if (t.includes("kadsorb") || t.includes("potasio")) {
      groupKey = "naturalslim-kadsorb";
      productName = "Kadsorb Potasio NaturalSlim";
    } else if (t.includes("duo") || t.includes("dúo")) {
      groupKey = "naturalslim-duo";
      productName = "Duo Dinamico Potasio y Magnesio";
    }

    return { groupKey, productName, variantLabel, brand: "NaturalSlim", skip: false };
  }

  // Group by catalog_product_id if available (for non-brand-specific items)
  if (item.catalog_product_id) {
    const productName = shortenTitle(item.title.replace(/\s+(color|sabor)\s+.*/i, "").trim());
    return {
      groupKey: `catalog-${item.catalog_product_id}`,
      productName,
      variantLabel,
      brand,
      skip: false,
    };
  }

  // Everything else — individual product
  return {
    groupKey: `individual-${item.id}`,
    productName: shortenTitle(item.title),
    variantLabel,
    brand,
    skip: false,
  };
}

async function getOrCreateAutoSupplier(): Promise<string> {
  let supplier = await prisma.supplier.findUnique({
    where: { name: "ML-AUTO" },
  });
  if (!supplier) {
    supplier = await prisma.supplier.create({
      data: {
        name: "ML-AUTO",
        notes: "Auto-created supplier for ML imported products",
      },
    });
  }
  return supplier.id;
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
    let productsCreated = 0;
    let variantsCreated = 0;

    // Get or create the ML-AUTO supplier once
    const autoSupplierId = await getOrCreateAutoSupplier();

    // Clean up ALL old Bluemango products (merge into single product on re-sync)
    const bluemangoProds = await prisma.product.findMany({
      where: { brand: "Bluemango", supplierId: autoSupplierId },
    });
    for (const prod of bluemangoProds) {
      await prisma.packItem.deleteMany({
        where: { productVariant: { productId: prod.id } },
      });
      await prisma.stockLog.deleteMany({
        where: { productVariant: { productId: prod.id } },
      });
      await prisma.stockEntryItem.deleteMany({
        where: { productVariant: { productId: prod.id } },
      });
      await prisma.productVariant.deleteMany({
        where: { productId: prod.id },
      });
      await prisma.product.delete({ where: { id: prod.id } });
    }

    // Cache for product lookups by groupKey to avoid repeated queries
    const productCache = new Map<string, { productId: string; variants: Map<string, string> }>();

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

      // Step 1: Upsert the listing and get the pack
      let packId: string;

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
        packId = existing.packId;

        if (item.thumbnail) {
          await prisma.pack.update({
            where: { id: packId },
            data: { imageUrl: item.thumbnail },
          });
        }

        updated++;
      } else {
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
              imageUrl: item.thumbnail || null,
            },
          });
          packsCreated++;
        } else if (item.thumbnail && !pack.imageUrl) {
          await prisma.pack.update({
            where: { id: pack.id },
            data: { imageUrl: item.thumbnail },
          });
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
        packId = pack.id;
        created++;
      }

      // Step 2: Smart Product Auto-Import (runs for ALL items, not just new)
      const classification = classifyListing(item);

      if (!classification.skip) {
        let cachedProduct = productCache.get(classification.groupKey);

        if (!cachedProduct) {
          let product = await prisma.product.findFirst({
            where: {
              supplierId: autoSupplierId,
              name: classification.productName,
              brand: classification.brand,
            },
            include: { variants: true },
          });

          if (!product) {
            product = await prisma.product.create({
              data: {
                name: classification.productName,
                supplierCode: `AUTO-${classification.groupKey.substring(0, 30)}-${Date.now()}`,
                unitCost: 0,
                supplierId: autoSupplierId,
                brand: classification.brand,
              },
              include: { variants: true },
            });
            productsCreated++;
          }

          const variantsMap = new Map<string, string>();
          for (const v of product.variants) {
            if (v.variantLabel) {
              variantsMap.set(v.variantLabel.toLowerCase(), v.id);
            }
          }
          cachedProduct = { productId: product.id, variants: variantsMap };
          productCache.set(classification.groupKey, cachedProduct);
        }

        const variantKey = classification.variantLabel.toLowerCase();
        let variantId = cachedProduct.variants.get(variantKey);

        if (!variantId) {
          const variant = await prisma.productVariant.create({
            data: {
              productId: cachedProduct.productId,
              variantLabel: classification.variantLabel,
              stock: item.available_quantity || 0,
            },
          });
          variantId = variant.id;
          cachedProduct.variants.set(variantKey, variantId);
          variantsCreated++;
        } else {
          // Accumulate stock from additional listings for the same variant
          await prisma.productVariant.update({
            where: { id: variantId },
            data: { stock: { increment: item.available_quantity || 0 } },
          });
        }

        const existingPackItem = await prisma.packItem.findUnique({
          where: {
            packId_productVariantId: {
              packId,
              productVariantId: variantId,
            },
          },
        });

        if (!existingPackItem) {
          await prisma.packItem.create({
            data: {
              packId,
              productVariantId: variantId,
              quantity: 1,
            },
          });
        }
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
      message: `Sincronizacion completa: ${created} nuevas, ${updated} actualizadas, ${packsCreated} packs creados, ${productsCreated} productos, ${variantsCreated} variantes de ${itemIds.length} publicaciones`,
      count: itemIds.length,
      created,
      updated,
      packsCreated,
      productsCreated,
      variantsCreated,
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
