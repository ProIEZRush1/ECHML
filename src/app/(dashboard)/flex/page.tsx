export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/shared/page-header";
import { computeFlex } from "@/lib/finance/flex";
import { FlexView } from "./flex-view";

export default async function FlexPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const sp = await searchParams;
  const from = sp?.from || null;
  const data = await computeFlex(from);
  return (
    <div className="space-y-4">
      <PageHeader title="Flex (Envíos)" description="Costo de envíos Flex, pagos y saldo con la paquetería — detallado por grupo." />
      <FlexView data={data} />
    </div>
  );
}
