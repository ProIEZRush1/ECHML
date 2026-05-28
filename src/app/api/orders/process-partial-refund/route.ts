import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAnyAuth } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { orderId } = (await request.json()) as { orderId: string };
  if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

  const order = await prisma.mLOrder.findUnique({ where: { id: orderId } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.partialRefundProcessed) return NextResponse.json({ error: "Already processed" }, { status: 400 });
  if (order.partialRefundQty <= 0) return NextResponse.json({ error: "No partial refund to process" }, { status: 400 });

  const listing = await prisma.mLListing.findUnique({
    where: { mlItemId: order.mlItemId },
    include: { pack: { include: { items: { include: { productVariant: true } } } } },
  });

  if (!listing?.pack) return NextResponse.json({ error: "Pack not found for this order" }, { status: 404 });

  const stockUpdates: { variantId: string; qty: number }[] = [];
  for (const item of listing.pack.items) {
    const addBack = item.quantity * order.partialRefundQty;
    stockUpdates.push({ variantId: item.productVariantId, qty: addBack });

    await prisma.productVariant.update({
      where: { id: item.productVariantId },
      data: { stock: { increment: addBack } },
    });

    await prisma.stockLog.create({
      data: {
        productVariantId: item.productVariantId,
        changeType: "ADJUSTMENT",
        quantityChange: addBack,
        previousStock: item.productVariant.stock,
        newStock: item.productVariant.stock + addBack,
        reason: `Reembolso parcial orden #${order.mlOrderId} (${order.partialRefundQty} unidad${order.partialRefundQty > 1 ? "es" : ""} no enviada${order.partialRefundQty > 1 ? "s" : ""})`,
      },
    });
  }

  await prisma.mLOrder.update({
    where: { id: orderId },
    data: { partialRefundProcessed: true },
  });

  return NextResponse.json({ success: true, stockUpdates, refundedQty: order.partialRefundQty });
}
