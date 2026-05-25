import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const V2_PRODUCT_IDS = [
  "cmpkthl3l00oyny01q5c3rw3d", // Biberon 270ml v2
  "cmpkthwca00p8ny01fhv6mxh6", // Cepillo Biberon v2
  "cmpkti37k00peny01e1n80owc", // Dispensador Leche v2
  "cmpkti3y500pkny01vpgxo5qr", // Vaso Entrenador v2
  "cmpkti4y000pqny01z5xmubfh", // Aspirador Nasal v2
  "cmpkti68v00pxny017v3affvu", // Set Peine Cepillo v2
  "cmpkti72r00q3ny011hwnt219", // Set Tenedor Cuchara v2
];

const V2_VARIANTS = {
  bib270_azul: "cmpkthl3m00ozny015g7te4w1",
  bib270_verde: "cmpkthl3m00p0ny01iwqkxvm5",
  bib270_rosa: "cmpkthl3m00p1ny015j1mhajx",
  bib270_morado: "cmpkthl3m00p2ny017jiwvzsu",
  cepillo_azul: "cmpkthwcb00p9ny0115pxjugv",
  dispensador_azul: "cmpkti37k00pfny01y9gcau12",
  vaso_azul: "cmpkti3y600plny016aq679yu",
  aspirador_azul: "cmpkti4y100prny01csft14uz",
  peine_azul: "cmpkti68w00pyny01zmb5ugdq",
  tenedor_azul: "cmpkti72r00q4ny01mxxdi5uz",
};

const BASE_BIB = [V2_VARIANTS.bib270_azul, V2_VARIANTS.bib270_verde, V2_VARIANTS.bib270_rosa, V2_VARIANTS.bib270_morado];

const COMPOSITIONS: Record<string, string[]> = {
  pack4bib: [...BASE_BIB, V2_VARIANTS.cepillo_azul],
  kitRN: [...BASE_BIB, V2_VARIANTS.cepillo_azul, V2_VARIANTS.dispensador_azul],
  kitBS: [...BASE_BIB, V2_VARIANTS.vaso_azul, V2_VARIANTS.peine_azul],
  kitLC: [...BASE_BIB, V2_VARIANTS.aspirador_azul, V2_VARIANTS.dispensador_azul],
  kitRG: [...BASE_BIB, V2_VARIANTS.tenedor_azul, V2_VARIANTS.cepillo_azul],
};

const NEW_TIMIS_ML_IDS: Record<string, string[]> = {
  pack4bib: ["2955053575", "2955053537", "2955053359", "2955053639", "2954965149"],
  kitBS: ["2954927103", "2955054033", "2955054017", "2954965481", "2954965519"],
  kitRN: ["2954926827", "2955053799", "2954965247", "2954965395", "2954926953"],
  kitLC: ["2955054071", "2955090683", "2954965593", "2955090695", "2955054095"],
  kitRG: ["2954965675", "2955054131", "2954927159", "2955090735", "2955054103"],
};

function classifyPack(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.includes("pack 4") || (lower.includes("biberones") && lower.includes("pack") && !lower.includes("kit"))) return "pack4bib";
  if (lower.includes("baby shower")) return "kitBS";
  if (lower.includes("recien nacido")) return "kitRN";
  if (lower.includes("lactancia")) return "kitLC";
  if (lower.includes("regalo")) return "kitRG";
  return null;
}

export async function POST() {
  const log: string[] = [];
  const OLD_GROUP_ID = "cmowh3o720000mw015dfs54mi";

  try {
    // 1. Remove v2 products from old Timi's group
    const deleted = await prisma.productGroupItem.deleteMany({
      where: { productGroupId: OLD_GROUP_ID, productId: { in: V2_PRODUCT_IDS } },
    });
    log.push(`Removed ${deleted.count} v2 products from old Timi's group`);

    // 2. Create new product group
    let newGroup;
    const existing = await prisma.productGroup.findUnique({ where: { name: "Timi's Nuevo" } });
    if (existing) {
      newGroup = existing;
      log.push(`Group "Timi's Nuevo" already exists: ${existing.id}`);
    } else {
      newGroup = await prisma.productGroup.create({
        data: { name: "Timi's Nuevo", color: "#10b981" },
      });
      log.push(`Created group "Timi's Nuevo": ${newGroup.id}`);
    }

    // 3. Add v2 products to new group
    let addedCount = 0;
    for (const productId of V2_PRODUCT_IDS) {
      const exists = await prisma.productGroupItem.findFirst({
        where: { productGroupId: newGroup.id, productId },
      });
      if (!exists) {
        await prisma.productGroupItem.create({
          data: { productGroupId: newGroup.id, productId },
        });
        addedCount++;
      }
    }
    log.push(`Added ${addedCount} v2 products to new group`);

    // 4. Fix pack compositions for all 25 new ML listings
    let packsFixed = 0;
    for (const [type, mlIds] of Object.entries(NEW_TIMIS_ML_IDS)) {
      const composition = COMPOSITIONS[type];
      if (!composition) continue;

      for (const mlId of mlIds) {
        const listing = await prisma.mLListing.findUnique({
          where: { mlItemId: `MLM${mlId}` },
          include: { pack: { include: { items: true } } },
        });

        if (!listing) {
          log.push(`WARN: Listing MLM${mlId} not found`);
          continue;
        }

        const pack = listing.pack;

        // Delete old pack items
        await prisma.packItem.deleteMany({ where: { packId: pack.id } });

        // Create new pack items with v2 variants
        for (const variantId of composition) {
          await prisma.packItem.create({
            data: { packId: pack.id, productVariantId: variantId, quantity: 1 },
          });
        }

        packsFixed++;
        log.push(`Fixed pack ${pack.sku} (${type}) → ${composition.length} v2 items`);
      }
    }
    log.push(`Total packs fixed: ${packsFixed}`);

    // 5. Delete the unused v2 packs (the template ones with no ML listings)
    const V2_PACK_SKUS = ["TM-4PK-BIB-V2", "TM-KIT-RN-V2", "TM-KIT-BS-V2", "TM-KIT-LC-V2", "TM-KIT-RG-V2"];
    for (const sku of V2_PACK_SKUS) {
      const pack = await prisma.pack.findUnique({ where: { sku }, include: { mlListings: true } });
      if (pack && pack.mlListings.length === 0) {
        await prisma.packItem.deleteMany({ where: { packId: pack.id } });
        await prisma.pack.delete({ where: { id: pack.id } });
        log.push(`Deleted unused template pack: ${sku}`);
      }
    }

    return NextResponse.json({ success: true, log });
  } catch (error) {
    return NextResponse.json({ success: false, log, error: String(error) }, { status: 500 });
  }
}
