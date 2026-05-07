export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { verifyAnyAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await verifyAnyAuth(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const packs = await prisma.pack.findMany({
    include: {
      items: {
        include: {
          productVariant: {
            include: { product: { select: { unitCost: true } } },
          },
        },
      },
      costs: true,
      mpTransactions: {
        where: { label: { in: ["sale", "fee", "shipping"] } },
      },
      mlListings: { select: { mlItemId: true, currentPrice: true } },
    },
    orderBy: { name: "asc" },
  });

  const report = packs.map((pack) => {
    const listPrice = Number(pack.salePrice);
    const sales = pack.mpTransactions.filter((t) => t.label === "sale");
    const fees = pack.mpTransactions.filter((t) => t.label === "fee");
    const shipping = pack.mpTransactions.filter((t) => t.label === "shipping");

    const totalSales = sales.reduce((sum, t) => sum + Number(t.amount), 0);
    const totalFees = fees.reduce((sum, t) => sum + Number(t.amount), 0);
    const totalShipping = shipping.reduce((sum, t) => sum + Number(t.amount), 0);
    const salesCount = sales.length;

    const salePrice = salesCount > 0 ? totalSales / salesCount : listPrice;

    const productCost = pack.items.reduce(
      (sum, item) => sum + Number(item.productVariant.product.unitCost) * item.quantity,
      0
    );

    const additionalCosts = pack.costs.reduce(
      (sum, c) => sum + Number(c.amount),
      0
    );

    const avgFeePerSale = salesCount > 0 ? totalFees / salesCount : salePrice * 0.18;
    const avgShippingPerSale = salesCount > 0 ? totalShipping / salesCount : 0;

    const totalCostPerUnit = productCost + additionalCosts;
    const profitPerSale = salePrice - avgFeePerSale - avgShippingPerSale - totalCostPerUnit;
    const marginPercent = salePrice > 0 ? (profitPerSale / salePrice) * 100 : 0;

    return {
      id: pack.id,
      sku: pack.sku,
      name: pack.name,
      salePrice,
      productCost,
      additionalCosts,
      additionalCostDetails: pack.costs.map((c) => ({
        id: c.id,
        category: c.category,
        amount: Number(c.amount),
        notes: c.notes,
      })),
      avgCommission: Math.round(avgFeePerSale * 100) / 100,
      avgShipping: Math.round(avgShippingPerSale * 100) / 100,
      totalCostPerUnit: Math.round(totalCostPerUnit * 100) / 100,
      profitPerSale: Math.round(profitPerSale * 100) / 100,
      marginPercent: Math.round(marginPercent * 10) / 10,
      totalSalesCount: salesCount,
      totalRevenue: Math.round(totalSales * 100) / 100,
      totalProfit: Math.round(profitPerSale * salesCount * 100) / 100,
    };
  });

  return NextResponse.json(report);
}
