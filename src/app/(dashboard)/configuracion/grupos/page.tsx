export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { GroupList } from "@/components/product-groups/group-list";
import { Palette } from "lucide-react";

export default async function GruposPage() {
  const session = await verifySession();
  if (!session) redirect("/login");

  const groups = await prisma.productGroup.findMany({
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, brand: true },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const serialized = groups.map((g) => ({
    id: g.id,
    name: g.name,
    color: g.color,
    createdAt: g.createdAt.toISOString(),
    products: g.items.map((i) => i.product),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Grupos de Productos"
        description="Presets para filtrar rapidamente por conjuntos de productos"
      />

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-[12.5px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Palette className="size-3.5" />
          {groups.length} grupo{groups.length !== 1 ? "s" : ""}
        </span>
        <span className="text-border">|</span>
        <span>
          {groups.reduce((sum, g) => sum + g.items.length, 0)} productos asignados
        </span>
      </div>

      <GroupList groups={serialized} />
    </div>
  );
}
