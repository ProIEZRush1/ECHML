import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mlFetch, getMLCredentials } from "@/lib/ml/client";

interface MLItem {
  id: string;
  title: string;
  family_name: string;
  category_id: string;
  price: number;
  original_price: number | null;
  available_quantity: number;
  pictures: { id: string }[];
  attributes: { id: string; value_name: string | null; value_id: string | null }[];
  sale_terms: unknown[];
  status: string;
  listing_type_id: string;
  condition: string;
}

const SIZE_MAP: Record<string, string> = {
  "5659469:1": "5659469:1", // S
  "5659469:2": "5659469:2", // L
  "5659469:3": "5659469:3", // M
};

export async function POST() {
  const log: string[] = [];

  try {
    // 1. CRM: Add XL variants to Playera Bluemango
    const product = await prisma.product.findUnique({
      where: { id: "prod-playera-bm" },
      include: { variants: true },
    });

    if (product) {
      const existingLabels = new Set(product.variants.map((v) => v.variantLabel));
      const xlVariants = ["Blanco / XL", "Negro / XL", "Gris / XL"];
      const createdVariantIds: string[] = [];

      for (const label of xlVariants) {
        if (existingLabels.has(label)) {
          const existing = product.variants.find((v) => v.variantLabel === label);
          if (existing) createdVariantIds.push(existing.id);
          log.push(`CRM: Variant ${label} already exists`);
          continue;
        }
        const variant = await prisma.productVariant.create({
          data: { productId: product.id, variantLabel: label, stock: 70 },
        });
        createdVariantIds.push(variant.id);
        log.push(`CRM: Created variant ${label} (id: ${variant.id}) with 70 stock`);
      }
      log.push(`CRM: ${createdVariantIds.length} XL variants ready`);
    }

    // 2. ML: Get all active listings
    const creds = await getMLCredentials();
    if (!creds) return NextResponse.json({ success: false, log, error: "No ML credentials" }, { status: 500 });
    const sellerId = creds.mlUserId.toString();

    const allItems: string[] = [];
    let offset = 0;
    while (true) {
      const page = await mlFetch<{ results: string[]; paging: { total: number } }>(
        `/users/${sellerId}/items/search?status=active&limit=100&offset=${offset}`
      );
      allItems.push(...page.results);
      if (offset + 100 >= page.paging.total) break;
      offset += 100;
    }
    log.push(`ML: Found ${allItems.length} total active listings`);

    // 3. Get details of all items in batches of 20
    const playeraLItems: MLItem[] = [];
    for (let i = 0; i < allItems.length; i += 20) {
      const batch = allItems.slice(i, i + 20);
      const items = await mlFetch<{ code: number; body: MLItem }[]>(
        `/items?ids=${batch.join(",")}&attributes=id,title,family_name,category_id,price,original_price,available_quantity,pictures,attributes,sale_terms,status,listing_type_id,condition`
      );
      for (const item of items) {
        if (item.code !== 200) continue;
        const body = item.body;
        const title = body.title.toLowerCase();
        if (!title.includes("playera") && !title.includes("oversize")) continue;

        const sizeAttr = body.attributes.find((a) => a.id === "SIZE");
        if (sizeAttr?.value_name === "L") {
          playeraLItems.push(body);
        }
      }
    }
    log.push(`ML: Found ${playeraLItems.length} playera L listings to clone as XL`);

    // 4. Create XL clones
    let created = 0;
    let failed = 0;
    for (const item of playeraLItems) {
      try {
        const newTitle = item.title.replace(/ L$/, " XL");
        const familyName = item.family_name;

        const skuAttr = item.attributes.find((a) => a.id === "SELLER_SKU");
        const newSku = skuAttr?.value_name
          ? skuAttr.value_name.replace(/-L-/, "-XL-").replace(/-L$/, "-XL")
          : undefined;

        const filteredAttrs = item.attributes.filter((a) =>
          !["GIFTABLE", "IS_EMERGING_BRAND", "IS_HIGHLIGHT_BRAND", "IS_TOM_BRAND", "ITEM_CONDITION"].includes(a.id)
        );

        const newAttrs = filteredAttrs.map((a) => {
          if (a.id === "SIZE") return { id: "SIZE", value_name: "XL" };
          if (a.id === "FILTRABLE_SIZE") return { id: "FILTRABLE_SIZE", value_name: "XG,XXG" };
          if (a.id === "SIZE_GRID_ROW_ID") return { id: "SIZE_GRID_ROW_ID", value_name: "5659469:4" };
          if (a.id === "SELLER_SKU" && newSku) return { id: "SELLER_SKU", value_name: newSku };
          return { id: a.id, value_name: a.value_name };
        });

        const payload = {
          title: newTitle,
          family_name: familyName,
          category_id: item.category_id,
          price: item.price,
          ...(item.original_price ? { original_price: item.original_price } : {}),
          available_quantity: 70,
          buying_mode: "buy_it_now",
          condition: "new",
          listing_type_id: item.listing_type_id,
          currency_id: "MXN",
          pictures: item.pictures.map((p) => ({ id: p.id })),
          attributes: newAttrs,
          sale_terms: item.sale_terms,
        };

        const result = await mlFetch<{ id: string; title: string } & Record<string, unknown>>(
          "/items",
          { method: "POST", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } }
        );

        if (result.id) {
          created++;
          log.push(`ML: Created ${result.id} - ${newTitle}`);
        } else {
          failed++;
          log.push(`ML: FAILED ${newTitle} - ${JSON.stringify(result).substring(0, 200)}`);
        }
      } catch (err) {
        failed++;
        log.push(`ML: ERROR cloning ${item.id} - ${String(err).substring(0, 150)}`);
      }
    }

    log.push(`ML: Created ${created} XL listings, ${failed} failed`);

    return NextResponse.json({ success: true, log, created, failed });
  } catch (error) {
    return NextResponse.json({ success: false, log, error: String(error) }, { status: 500 });
  }
}
