export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { FacturasClient } from "./facturas-client";

export default async function FacturasPage({
  searchParams,
}: {
  searchParams: Promise<{ productGroupId?: string; status?: string }>;
}) {
  const params = await searchParams;

  const where: Record<string, string> = {};
  if (params.productGroupId) where.productGroupId = params.productGroupId;
  if (params.status) where.status = params.status;

  const [facturas, productGroups] = await Promise.all([
    prisma.factura.findMany({
      where,
      include: {
        productGroup: { select: { id: true, name: true, color: true } },
      },
      orderBy: [{ fechaEmision: "desc" }, { createdAt: "desc" }],
    }),
    prisma.productGroup.findMany({
      select: {
        id: true,
        name: true,
        color: true,
        facturaSobreMercancia: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const serialized = facturas.map((f) => ({
    id: f.id,
    folio: f.folio,
    rfcEmisor: f.rfcEmisor,
    rfcReceptor: f.rfcReceptor,
    fechaEmision: f.fechaEmision?.toISOString() ?? null,
    subtotal: f.subtotal ? Number(f.subtotal) : null,
    iva: f.iva ? Number(f.iva) : null,
    total: Number(f.total),
    conceptos: f.conceptos,
    status: f.status,
    productGroupId: f.productGroupId,
    notes: f.notes,
    createdAt: f.createdAt.toISOString(),
    productGroup: f.productGroup,
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Facturas"
        description="Registro de facturas CFDI"
      />

      <FacturasClient
        facturas={serialized}
        productGroups={productGroups}
      />
    </div>
  );
}
