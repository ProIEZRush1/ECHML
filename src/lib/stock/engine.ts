import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { calculatePackStock, calculatePackStockWithFicticio } from "./calculator";
import { syncLinkedVariants } from "./sync";
import { mlFetch } from "@/lib/ml/client";

const MAX_RETRIES = 3;

export class InsufficientStockError extends Error {
  constructor(
    public variantId: string,
    public needed: number,
    public available: number
  ) {
    super(
      `Stock insuficiente: se necesitan ${needed} unidades pero solo hay ${available}`
    );
  }
}

export async function processSale(
  mlOrderId: bigint,
  mlItemId: string,
  quantitySold: number
): Promise<void> {
  const existing = await prisma.mLOrder.findUnique({
    where: { mlOrderId },
  });
  if (existing?.processedAt) return;

  const listing = await prisma.mLListing.findUnique({
    where: { mlItemId },
    include: {
      pack: {
        include: {
          items: { include: { productVariant: true } },
        },
      },
    },
  });
  if (!listing) {
    console.error(`Publicacion ML desconocida: ${mlItemId}`);
    return;
  }

  const affectedVariantIds = listing.pack.items.map(
    (i) => i.productVariantId
  );

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      await prisma.$transaction(
        async (tx) => {
          const variants = await tx.$queryRaw<
            Array<{ id: string; stock: number }>
          >`SELECT id, stock FROM "ProductVariant" WHERE id = ANY(${affectedVariantIds}::text[]) FOR UPDATE`;

          const variantMap = new Map(variants.map((v) => [v.id, v]));

          for (const item of listing.pack.items) {
            const variant = variantMap.get(item.productVariantId);
            if (!variant) continue;
            const needed = item.quantity * quantitySold;
            if (variant.stock < needed) {
              throw new InsufficientStockError(
                variant.id,
                needed,
                variant.stock
              );
            }
          }

          for (const item of listing.pack.items) {
            const variant = variantMap.get(item.productVariantId)!;
            const deduction = item.quantity * quantitySold;
            const newStock = variant.stock - deduction;

            await tx.productVariant.update({
              where: { id: variant.id },
              data: { stock: newStock },
            });

            await tx.stockLog.create({
              data: {
                productVariantId: variant.id,
                changeType: "SALE",
                quantityChange: -deduction,
                previousStock: variant.stock,
                newStock,
                reason: `Venta ${mlItemId} orden #${mlOrderId}`,
                mlOrderId,
              },
            });
          }

          await tx.mLOrder.upsert({
            where: { mlOrderId },
            create: {
              mlOrderId,
              mlItemId,
              quantity: quantitySold,
              unitPrice: listing.currentPrice ?? 0,
              totalAmount: (Number(listing.currentPrice ?? 0) * quantitySold),
              status: "paid",
              dateCreated: new Date(),
              processedAt: new Date(),
            },
            update: { processedAt: new Date() },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );

      const mirrored = await syncLinkedVariants(affectedVariantIds);
      await recalculateAffectedPacks([...affectedVariantIds, ...mirrored]);
      return;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034" &&
        attempt < MAX_RETRIES - 1
      ) {
        await new Promise((r) => setTimeout(r, 100 * Math.pow(2, attempt)));
        continue;
      }
      throw error;
    }
  }
}

export async function addStock(
  items: Array<{
    productVariantId: string;
    quantity: number;
    unitCost: number;
  }>,
  supplierId: string,
  userId: string,
  notes?: string,
  isFicticio?: boolean
): Promise<void> {
  const affectedVariantIds = items.map((i) => i.productVariantId);
  const totalCost = items.reduce(
    (sum, i) => sum + i.quantity * i.unitCost,
    0
  );

  await prisma.$transaction(
    async (tx) => {
      const entry = await tx.stockEntry.create({
        data: {
          supplierId,
          userId,
          notes: isFicticio ? `[FICTICIO] ${notes || ""}`.trim() : notes,
          totalCost,
        },
      });

      for (const item of items) {
        const variant = await tx.productVariant.findUniqueOrThrow({
          where: { id: item.productVariantId },
        });

        if (isFicticio) {
          const newFicticio = variant.ficticioStock + item.quantity;
          await tx.productVariant.update({
            where: { id: item.productVariantId },
            data: { ficticioStock: newFicticio },
          });
        } else {
          const newStock = variant.stock + item.quantity;
          await tx.productVariant.update({
            where: { id: item.productVariantId },
            data: { stock: newStock },
          });
        }

        const currentReal = isFicticio ? variant.stock : variant.stock + item.quantity;
        const currentFicticio = isFicticio ? variant.ficticioStock + item.quantity : variant.ficticioStock;

        await tx.stockEntryItem.create({
          data: {
            stockEntryId: entry.id,
            productVariantId: item.productVariantId,
            quantity: item.quantity,
            unitCost: item.unitCost,
          },
        });

        await tx.stockLog.create({
          data: {
            productVariantId: item.productVariantId,
            changeType: "MANUAL_ADD",
            quantityChange: item.quantity,
            previousStock: variant.stock,
            newStock: currentReal,
            reason: isFicticio
              ? `Stock ficticio${notes ? ` - ${notes}` : ""}`
              : notes ? `Entrada de stock - ${notes}` : "Entrada de stock",
            userId,
          },
        });
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  const mirrored = await syncLinkedVariants(affectedVariantIds);
  await recalculateAffectedPacks([...affectedVariantIds, ...mirrored]);
}

export async function adjustStock(
  productVariantId: string,
  newStockAmount: number,
  reason: string,
  userId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const variant = await tx.productVariant.findUniqueOrThrow({
      where: { id: productVariantId },
    });

    const change = newStockAmount - variant.stock;

    await tx.productVariant.update({
      where: { id: productVariantId },
      data: { stock: newStockAmount },
    });

    await tx.stockLog.create({
      data: {
        productVariantId,
        changeType: "ADJUSTMENT",
        quantityChange: change,
        previousStock: variant.stock,
        newStock: newStockAmount,
        reason,
        userId,
      },
    });
  });

  const mirrored = await syncLinkedVariants([productVariantId]);
  await recalculateAffectedPacks([productVariantId, ...mirrored]);
}

export async function recalculateAffectedPacks(
  variantIds: string[]
): Promise<void> {
  const affectedPackItems = await prisma.packItem.findMany({
    where: { productVariantId: { in: variantIds } },
    select: { packId: true },
  });

  const affectedPackIds = [...new Set(affectedPackItems.map((pi) => pi.packId))];

  for (const packId of affectedPackIds) {
    const pack = await prisma.pack.findUnique({
      where: { id: packId },
      include: {
        items: { include: { productVariant: true } },
        mlListings: true,
      },
    });
    if (!pack) continue;

    const newStock = calculatePackStock(pack.items);
    const mlStock = calculatePackStockWithFicticio(pack.items);

    await prisma.pack.update({
      where: { id: packId },
      data: { stock: newStock },
    });

    if (pack.stockSyncEnabled) {
      for (const listing of pack.mlListings) {
        if (listing.currentStock !== mlStock) {
          let pushedToML = false;
          try {
            await mlFetch(`/items/${listing.mlItemId}`, {
              method: "PUT",
              body: JSON.stringify({ available_quantity: mlStock }),
            });
            pushedToML = true;
          } catch (err) {
            console.error(`Failed to push stock to ML ${listing.mlItemId}:`, err);
          }

          await prisma.mLListing.update({
            where: { id: listing.id },
            data: {
              currentStock: mlStock,
              ...(pushedToML && { lastSyncedAt: new Date() }),
            },
          });
        }
      }
    }
  }
}
