export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { RentabilidadTable } from "./rentabilidad-table";

export default async function RentabilidadPage() {
  const session = await verifySession();
  if (!session) redirect("/login");

  const packs = await prisma.pack.findMany({
    include: {
      items: {
        include: {
          productVariant: {
            include: { product: { select: { unitCost: true, name: true } } },
          },
        },
      },
      costs: true,
      mpTransactions: {
        where: { label: { in: ["sale", "fee", "shipping"] } },
      },
    },
    orderBy: { name: "asc" },
  });

  const report = packs.map((pack) => {
    const listPrice = Number(pack.salePrice);
    const sales = pack.mpTransactions.filter((t) => t.label === "sale");
    const fees = pack.mpTransactions.filter((t) => t.label === "fee");
    const shipping = pack.mpTransactions.filter((t) => t.label === "shipping");

    const totalSalesAmount = sales.reduce((sum, t) => sum + Number(t.amount), 0);
    const totalFees = fees.reduce((sum, t) => sum + Number(t.amount), 0);
    const totalShipping = shipping.reduce((sum, t) => sum + Number(t.amount), 0);
    const salesCount = sales.length;

    const salePrice = salesCount > 0 ? totalSalesAmount / salesCount : listPrice;

    const productCost = pack.items.reduce(
      (sum, item) => sum + Number(item.productVariant.product.unitCost) * item.quantity,
      0
    );

    const additionalCosts = pack.costs.reduce((sum, c) => sum + Number(c.amount), 0);

    const avgFee = salesCount > 0 ? totalFees / salesCount : salePrice * 0.18;
    const avgShipping = salesCount > 0 ? totalShipping / salesCount : 0;

    const totalCost = productCost + additionalCosts;
    const profit = salePrice - avgFee - avgShipping - totalCost;
    const margin = salePrice > 0 ? (profit / salePrice) * 100 : 0;

    return {
      id: pack.id,
      sku: pack.sku,
      name: pack.name,
      salePrice,
      productCost: Math.round(productCost * 100) / 100,
      additionalCosts: Math.round(additionalCosts * 100) / 100,
      costDetails: pack.costs.map((c) => ({
        id: c.id,
        category: c.category,
        amount: Number(c.amount),
      })),
      avgCommission: Math.round(avgFee * 100) / 100,
      avgShipping: Math.round(avgShipping * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      margin: Math.round(margin * 10) / 10,
      salesCount,
      totalProfit: Math.round(profit * salesCount * 100) / 100,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rentabilidad"
        description="Utilidad neta por pack: precio, comisiones, envio, costos de producto y adicionales"
      />
      <RentabilidadTable data={report} />
    </div>
  );
}
