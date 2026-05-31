export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/shared/page-header";
import { SyncStatusButton } from "./sync-status-button";
import { computeOrderEconomics } from "@/lib/finance/order-economics";
import { PedidosContent } from "./pedidos-content";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const defFrom = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  const defTo = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const from = /^\d{4}-\d{2}-\d{2}$/.test(params.from || "") ? params.from! : defFrom;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(params.to || "") ? params.to! : defTo;

  const { rows, summary } = await computeOrderEconomics({
    from: new Date(`${from}T00:00:00`),
    to: new Date(`${to}T23:59:59.999`),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PageHeader title="Pedidos" description="Cada venta: lo vendido, comisión, envío, devoluciones y envío extra → neto (ganas o pierdes)" />
        <SyncStatusButton />
      </div>
      <PedidosContent rows={rows} summary={summary} from={from} to={to} />
    </div>
  );
}
