const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const PRODUCT_TYPES = {
  "TM-2OZ": { name: "Biberon 60ml Timi's", packSize: 3 },
  "TM-5OZ": { name: "Biberon 150ml Timi's", packSize: 3 },
  "TM-15V": { name: "Biberon 250ml Timi's", packSize: 3 },
  "TM-14": { name: "Biberon 270ml Timi's", packSize: 4 },
  "TM-CHUP3": { name: "Chupon Ortodontico Timi's", packSize: 3 },
  "TM-CHUPAUTO": { name: "Chupon Cierre Auto Timi's", packSize: 2 },
  "TM-SUJET": { name: "Sujetador Chupon Timi's", packSize: 2 },
  "TM-DISP": { name: "Dispensador Leche Timi's", packSize: 1 },
  "TM-VASO": { name: "Vaso Entrenador Timi's", packSize: 1 },
};

const LISTINGS = [
  // Biberon 60ml (TM-2OZ)
  { mlId: "MLM5287902064", sku: "TM-2OZ-V", color: "Verde y Azul", units: 3, stock: 8 },
  { mlId: "MLM2908028527", sku: "TM-2OZ-V2", color: "Multicolor", units: 3, stock: 8 },
  { mlId: "MLM5290489752", sku: "TM-2OZ-V3", color: "Multicolor", units: 3, stock: 48 },
  { mlId: "MLM5290401510", sku: "TM-2OZ-V4", color: "Multicolor", units: 3, stock: 48 },
  { mlId: "MLM5290401524", sku: "TM-2OZ-V5", color: "Multicolor", units: 3, stock: 48 },
  // Biberon 150ml (TM-5OZ)
  { mlId: "MLM5287907296", sku: "TM-5OZ", color: "Multicolor", units: 3, stock: 8 },
  { mlId: "MLM2907980969", sku: "TM-5OZ-V2", color: "Multicolor", units: 3, stock: 8 },
  { mlId: "MLM5290401590", sku: "TM-5OZ-V3", color: "Multicolor", units: 3, stock: 48 },
  { mlId: "MLM5290401600", sku: "TM-5OZ-V4", color: "Multicolor", units: 3, stock: 48 },
  { mlId: "MLM5290401642", sku: "TM-5OZ-V5", color: "Multicolor", units: 3, stock: 48 },
  // Biberon 250ml (TM-15V) — Verde y Azul only
  { mlId: "MLM5290401660", sku: "TM-15V-V3", color: "Verde y azul", units: 3, stock: 48 },
  { mlId: "MLM5290489840", sku: "TM-15V-V4", color: "Verde y azul", units: 3, stock: 48 },
  { mlId: "MLM5290363832", sku: "TM-15V-V5", color: "Verde y azul", units: 3, stock: 48 },
  // Biberon 270ml (TM-14V) — Verde y Azul, pack 4
  { mlId: "MLM2908860145", sku: "TM-14V-V2", color: "Verde y azul", units: 4, stock: 48 },
  { mlId: "MLM2908786299", sku: "TM-14V-V3", color: "Verde y azul", units: 4, stock: 48 },
  { mlId: "MLM2908811177", sku: "TM-14V-V4", color: "Verde y azul", units: 4, stock: 48 },
  { mlId: "MLM2908799051", sku: "TM-14V-V5", color: "Verde y azul", units: 4, stock: 48 },
  // Chupones Ortodonticos (TM-CHUP3)
  { mlId: "MLM5287883470", sku: "TM-CHUP3", color: "Multicolor", units: 3, stock: 8 },
  { mlId: "MLM2907985561", sku: "TM-CHUP3-V2", color: "Multicolor", units: 3, stock: 8 },
  { mlId: "MLM5290363850", sku: "TM-CHUP3-V3", color: "Multicolor", units: 3, stock: 24 },
  { mlId: "MLM5290489896", sku: "TM-CHUP3-V4", color: "Multicolor", units: 3, stock: 24 },
  { mlId: "MLM5290363908", sku: "TM-CHUP3-V5", color: "Multicolor", units: 3, stock: 24 },
  // Chupones Cierre Auto (TM-CHUPAUTO)
  { mlId: "MLM5287884704", sku: "TM-CHUPAUTO", color: "Multicolor", units: 2, stock: 24 },
  { mlId: "MLM5290396402", sku: "TM-CHUPAUTO-V2", color: "Multicolor", units: 2, stock: 24 },
  { mlId: "MLM5290363916", sku: "TM-CHUPAUTO-V3", color: "Multicolor", units: 2, stock: 24 },
  { mlId: "MLM5290401800", sku: "TM-CHUPAUTO-V4", color: "Multicolor", units: 2, stock: 24 },
  { mlId: "MLM5290363962", sku: "TM-CHUPAUTO-V5", color: "Multicolor", units: 2, stock: 24 },
  // Sujetadores (TM-SUJET)
  { mlId: "MLM2907795519", sku: "TM-SUJET", color: "Multicolor", units: 2, stock: 24 },
  { mlId: "MLM5290358638", sku: "TM-SUJET-V2", color: "Multicolor", units: 2, stock: 24 },
  { mlId: "MLM5290402024", sku: "TM-SUJET-V3", color: "Multicolor", units: 2, stock: 24 },
  { mlId: "MLM5290402034", sku: "TM-SUJET-V4", color: "Multicolor", units: 2, stock: 24 },
  { mlId: "MLM5290377024", sku: "TM-SUJET-V5", color: "Multicolor", units: 2, stock: 24 },
  // Dispensadores (TM-DISP) — no color
  { mlId: "MLM5287987340", sku: "TM-DISP", color: "", units: 1, stock: 48 },
  { mlId: "MLM2908455707", sku: "TM-DISP-V2", color: "", units: 1, stock: 48 },
  { mlId: "MLM5290401964", sku: "TM-DISP-V3", color: "", units: 1, stock: 48 },
  { mlId: "MLM5290364106", sku: "TM-DISP-V4", color: "", units: 1, stock: 48 },
  { mlId: "MLM5290364138", sku: "TM-DISP-V5", color: "", units: 1, stock: 48 },
  // Vasos (TM-VASO) — multicolor but single unit
  { mlId: "MLM2907742319", sku: "TM-VASO", color: "Multicolor", units: 1, stock: 48 },
  { mlId: "MLM2908455641", sku: "TM-VASO-V2", color: "Multicolor", units: 1, stock: 48 },
  { mlId: "MLM5290490018", sku: "TM-VASO-V3", color: "Multicolor", units: 1, stock: 48 },
  { mlId: "MLM5290490030", sku: "TM-VASO-V4", color: "Multicolor", units: 1, stock: 48 },
  { mlId: "MLM5290364064", sku: "TM-VASO-V5", color: "Multicolor", units: 1, stock: 48 },
];

function getProductType(sku) {
  if (sku.startsWith("TM-14")) return "TM-14";
  if (sku.startsWith("TM-15V")) return "TM-15V";
  if (sku.startsWith("TM-5OZ")) return "TM-5OZ";
  if (sku.startsWith("TM-2OZ")) return "TM-2OZ";
  if (sku.startsWith("TM-CHUP3")) return "TM-CHUP3";
  if (sku.startsWith("TM-CHUPAUTO")) return "TM-CHUPAUTO";
  if (sku.startsWith("TM-SUJET")) return "TM-SUJET";
  if (sku.startsWith("TM-DISP")) return "TM-DISP";
  if (sku.startsWith("TM-VASO")) return "TM-VASO";
  return null;
}

async function setup() {
  const supplier = await prisma.supplier.upsert({
    where: { name: "Timi's" },
    create: { name: "Timi's", contact: "Proveedor Timi's" },
    update: {},
  });

  const COLORS = ["AZUL", "VERDE", "ROSA", "MORADO"];
  const productMap = {};

  for (const [typeKey, typeDef] of Object.entries(PRODUCT_TYPES)) {
    const typeListings = LISTINGS.filter((l) => getProductType(l.sku) === typeKey);
    if (typeListings.length === 0) continue;

    const minStock = Math.min(...typeListings.map((l) => l.stock));
    const hasColor = typeListings.some((l) => l.color);
    const isVerdeAzul = typeListings.every((l) => l.color === "Verde y azul" || l.color === "Verde y Azul" || !l.color);
    const onlyVerdeAzul = typeListings.some((l) => l.color.toLowerCase().includes("verde"));

    const product = await prisma.product.create({
      data: {
        name: typeDef.name,
        supplierCode: typeKey,
        unitCost: 0,
        supplierId: supplier.id,
        brand: "Timi's",
      },
    });

    const variants = {};

    if (!hasColor || typeKey === "TM-DISP") {
      const v = await prisma.productVariant.create({
        data: { productId: product.id, variantLabel: "Default", stock: minStock },
      });
      variants["Default"] = v;
    } else if (isVerdeAzul && onlyVerdeAzul && !typeListings.some((l) => l.color === "Multicolor")) {
      for (const color of ["VERDE", "AZUL"]) {
        const stockPerColor = typeDef.packSize === 4 ? minStock * 2 : Math.ceil((minStock * typeDef.packSize) / 2);
        const v = await prisma.productVariant.create({
          data: { productId: product.id, color, variantLabel: color.charAt(0) + color.slice(1).toLowerCase(), stock: stockPerColor },
        });
        variants[color] = v;
      }
    } else {
      for (const color of COLORS) {
        const stockPerColor = minStock;
        const v = await prisma.productVariant.create({
          data: { productId: product.id, color, variantLabel: color.charAt(0) + color.slice(1).toLowerCase(), stock: stockPerColor },
        });
        variants[color] = v;
      }
    }

    productMap[typeKey] = { product, variants, typeDef };
    console.log(`Created product: ${typeDef.name} with ${Object.keys(variants).length} variants (stock: ${minStock} base)`);
  }

  let linked = 0;
  for (const listing of LISTINGS) {
    const typeKey = getProductType(listing.sku);
    if (!typeKey || !productMap[typeKey]) continue;

    const { variants, typeDef } = productMap[typeKey];
    const pack = await prisma.pack.findFirst({
      where: { mlListings: { some: { mlItemId: listing.mlId } } },
    });
    if (!pack) {
      console.log(`  No pack for ${listing.mlId}, skipping`);
      continue;
    }

    const existingItems = await prisma.packItem.findMany({ where: { packId: pack.id } });
    if (existingItems.length > 0) {
      await prisma.packItem.deleteMany({ where: { packId: pack.id } });
    }

    const colorKey = listing.color.toLowerCase();
    if (variants["Default"]) {
      await prisma.packItem.create({
        data: { packId: pack.id, productVariantId: variants["Default"].id, quantity: listing.units },
      });
    } else if (colorKey.includes("verde") && !colorKey.includes("multi")) {
      const perColor = listing.units === 4 ? 2 : listing.units === 3 ? 2 : 1;
      const remaining = listing.units - perColor;
      await prisma.packItem.create({
        data: { packId: pack.id, productVariantId: variants["VERDE"].id, quantity: perColor },
      });
      await prisma.packItem.create({
        data: { packId: pack.id, productVariantId: variants["AZUL"].id, quantity: remaining },
      });
    } else {
      const colorsToUse = Object.keys(variants).slice(0, listing.units);
      for (const color of colorsToUse) {
        await prisma.packItem.create({
          data: { packId: pack.id, productVariantId: variants[color].id, quantity: 1 },
        });
      }
    }

    linked++;
  }

  console.log(`\nLinked ${linked} packs to shared variants.`);
  console.log("Run /api/stock/recalculate to push updated stock to ML.");
  await prisma.$disconnect();
}

setup().catch((e) => {
  console.error("Setup error:", e.message);
  prisma.$disconnect();
});
