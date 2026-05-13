export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import Link from "next/link";
import { NuevoGastoForm } from "./nuevo-gasto-form";

export default async function NuevoGastoPage() {
  const [suppliers, products, packs, groups, sales] = await Promise.all([
    prisma.supplier.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.pack.findMany({ select: { id: true, sku: true, name: true }, orderBy: { name: "asc" } }),
    prisma.productGroup.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.mPTransaction.findMany({
      where: { label: "sale" },
      orderBy: { dateCreated: "desc" },
      take: 200,
      include: {
        pack: {
          select: {
            id: true, sku: true, name: true, imageUrl: true,
            items: {
              select: {
                quantity: true,
                productVariant: { select: { color: true, variantLabel: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  const serializedSales = sales.map((tx) => ({
    id: tx.id,
    mpId: tx.mpId.toString(),
    description: tx.description,
    amount: Number(tx.amount),
    label: tx.label,
    dateCreated: tx.dateCreated.toISOString(),
    packId: tx.packId,
    pack: tx.pack,
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <PageHeader title="Nuevo Gasto" description="Registra un gasto operativo con asignacion a ventas" />
        <Link href="/gastos" className="filt-input">Volver a Gastos</Link>
      </div>
      <NuevoGastoForm
        suppliers={suppliers}
        products={products}
        packs={packs}
        groups={groups}
        sales={serializedSales}
      />
    </div>
  );
}
