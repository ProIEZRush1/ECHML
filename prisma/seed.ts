import { PrismaClient, Color } from "@prisma/client";
import { hash } from "bcryptjs";
import { calculatePackStock } from "../src/lib/stock/calculator";

const prisma = new PrismaClient();

const PRODUCTS = [
  { code: "501108", name: "Biberon 2oz/60ml", cost: 25 },
  { code: "501129", name: "Biberon 5oz/150ml", cost: 26 },
  { code: "501135", name: "Biberon 9oz/250ml regular", cost: 27 },
  { code: "501137", name: "Biberon cuello ancho 9oz/270ml", cost: 39 },
  { code: "451219", name: "Chupon #1 (0-3m)", cost: 23 },
  { code: "451220", name: "Chupon #2 (3-6m)", cost: 23 },
  { code: "451221", name: "Chupon #3 (6m+)", cost: 23 },
  { code: "451212", name: "Chupon cierre automatico", cost: 29 },
  { code: "505015", name: "Sujetador de chupon", cost: 25 },
  { code: "502121", name: "Vaso entrenador 9oz/250ml", cost: 49 },
  { code: "507503", name: "Dispensador de leche", cost: 35 },
];

const COLORS: Color[] = ["AZUL", "VERDE", "ROSA", "MORADO"];
const INITIAL_STOCK = 12;

interface PackDef {
  sku: string;
  name: string;
  salePrice: number;
  productCode: string;
  composition: Array<{ color: Color; quantity: number }>;
}

const PACKS: PackDef[] = [
  {
    sku: "TM-14-V",
    name: "4-pack Biberon cuello ancho Azul/Verde",
    salePrice: 299,
    productCode: "501137",
    composition: [
      { color: "AZUL", quantity: 2 },
      { color: "VERDE", quantity: 2 },
    ],
  },
  {
    sku: "TM-14-H",
    name: "4-pack Biberon cuello ancho Rosa/Morado",
    salePrice: 299,
    productCode: "501137",
    composition: [
      { color: "ROSA", quantity: 2 },
      { color: "MORADO", quantity: 2 },
    ],
  },
  {
    sku: "TM-15-V",
    name: "3-pack Biberon regular 250ml Azul/Verde",
    salePrice: 199,
    productCode: "501135",
    composition: [
      { color: "AZUL", quantity: 2 },
      { color: "VERDE", quantity: 1 },
    ],
  },
  {
    sku: "TM-15-H",
    name: "3-pack Biberon regular 250ml Rosa/Morado",
    salePrice: 199,
    productCode: "501135",
    composition: [
      { color: "ROSA", quantity: 2 },
      { color: "MORADO", quantity: 1 },
    ],
  },
  {
    sku: "TM-16-V",
    name: "3-pack Biberon 150ml Azul/Verde",
    salePrice: 179,
    productCode: "501129",
    composition: [
      { color: "AZUL", quantity: 2 },
      { color: "VERDE", quantity: 1 },
    ],
  },
  {
    sku: "TM-16-H",
    name: "3-pack Biberon 150ml Rosa/Morado",
    salePrice: 179,
    productCode: "501129",
    composition: [
      { color: "ROSA", quantity: 2 },
      { color: "MORADO", quantity: 1 },
    ],
  },
];

const ML_LISTINGS: Record<string, string[]> = {
  "TM-14-V": [
    "MLM5259271618",
    "MLM5262345540",
    "MLM5263921044",
    "MLM5263959664",
    "MLM5263959666",
  ],
  "TM-14-H": [
    "MLM5266930694",
    "MLM5266930704",
    "MLM5266956516",
    "MLM5266956524",
    "MLM5266969412",
  ],
  "TM-15-V": [
    "MLM2905837641",
    "MLM2905851667",
    "MLM5283172774",
    "MLM5283172776",
    "MLM5283287446",
  ],
};

async function main() {
  console.log("Seeding database...");

  const admin = await prisma.user.upsert({
    where: { email: "edumaucherni@gmail.com" },
    update: {},
    create: {
      email: "edumaucherni@gmail.com",
      name: "Eduardo",
      passwordHash: await hash("Eduardo2006!", 10),
      role: "ADMIN",
    },
  });
  console.log(`  Usuario admin: ${admin.email}`);

  const supplier = await prisma.supplier.upsert({
    where: { name: "SUPLYADORNOS" },
    update: {},
    create: {
      name: "SUPLYADORNOS",
      contact: "Proveedor principal",
      notes: "Proveedor principal de productos",
    },
  });
  console.log(`  Proveedor: ${supplier.name}`);

  const productMap = new Map<string, string>();
  const variantMap = new Map<string, string>();

  for (const p of PRODUCTS) {
    const product = await prisma.product.upsert({
      where: {
        supplierId_supplierCode: {
          supplierId: supplier.id,
          supplierCode: p.code,
        },
      },
      update: { unitCost: p.cost },
      create: {
        name: p.name,
        supplierCode: p.code,
        unitCost: p.cost,
        supplierId: supplier.id,
      },
    });
    productMap.set(p.code, product.id);

    for (const color of COLORS) {
      const variant = await prisma.productVariant.upsert({
        where: {
          productId_color: { productId: product.id, color },
        },
        update: {},
        create: {
          productId: product.id,
          color,
          stock: INITIAL_STOCK,
        },
      });
      variantMap.set(`${p.code}-${color}`, variant.id);

      const existingLog = await prisma.stockLog.findFirst({
        where: {
          productVariantId: variant.id,
          changeType: "INITIAL",
        },
      });
      if (!existingLog) {
        await prisma.stockLog.create({
          data: {
            productVariantId: variant.id,
            changeType: "INITIAL",
            quantityChange: INITIAL_STOCK,
            previousStock: 0,
            newStock: INITIAL_STOCK,
            reason: "Stock inicial de seed",
          },
        });
      }
    }
    console.log(`  Producto: ${p.name} (${p.code}) - 4 variantes x ${INITIAL_STOCK} unidades`);
  }

  for (const packDef of PACKS) {
    const pack = await prisma.pack.upsert({
      where: { sku: packDef.sku },
      update: { salePrice: packDef.salePrice },
      create: {
        sku: packDef.sku,
        name: packDef.name,
        salePrice: packDef.salePrice,
        stock: 0,
      },
    });

    for (const comp of packDef.composition) {
      const variantId = variantMap.get(`${packDef.productCode}-${comp.color}`);
      if (!variantId) {
        console.error(`  Variante no encontrada: ${packDef.productCode}-${comp.color}`);
        continue;
      }

      await prisma.packItem.upsert({
        where: {
          packId_productVariantId: { packId: pack.id, productVariantId: variantId },
        },
        update: { quantity: comp.quantity },
        create: {
          packId: pack.id,
          productVariantId: variantId,
          quantity: comp.quantity,
        },
      });
    }

    const packWithItems = await prisma.pack.findUnique({
      where: { id: pack.id },
      include: { items: { include: { productVariant: true } } },
    });
    if (packWithItems) {
      const calculatedStock = calculatePackStock(packWithItems.items);
      await prisma.pack.update({
        where: { id: pack.id },
        data: { stock: calculatedStock },
      });
      console.log(`  Pack: ${packDef.sku} - ${packDef.name} (stock: ${calculatedStock})`);
    }

    const listings = ML_LISTINGS[packDef.sku];
    if (listings) {
      for (const mlItemId of listings) {
        await prisma.mLListing.upsert({
          where: { mlItemId },
          update: { packId: pack.id },
          create: {
            mlItemId,
            packId: pack.id,
            title: packDef.name,
            status: "ACTIVE",
            currentStock: packWithItems
              ? calculatePackStock(packWithItems.items)
              : 0,
            currentPrice: packDef.salePrice,
          },
        });
      }
      console.log(`    ${listings.length} publicaciones ML vinculadas`);
    }
  }

  console.log("\nSeed completado exitosamente!");
  console.log(`  ${PRODUCTS.length} productos`);
  console.log(`  ${PRODUCTS.length * COLORS.length} variantes`);
  console.log(`  ${PACKS.length} packs`);
  console.log(`  ${Object.values(ML_LISTINGS).flat().length} publicaciones ML`);
}

main()
  .catch((e) => {
    console.error("Error en seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
