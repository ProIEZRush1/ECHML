"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck, Printer, Truck } from "lucide-react";

interface PrepActionsProps {
  orderId: string;
  currentStatus: string;
}

export function PrepActions({ orderId, currentStatus }: PrepActionsProps) {
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const orderIds = orderId.split(",").filter(Boolean);

  async function updateStatus(newStatus: string) {
    setLoading(true);
    try {
      if (orderIds.length > 1) {
        const res = await fetch("/api/orders/prep-status", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderIds, prepStatus: newStatus }),
        });
        if (res.ok) {
          setStatus(newStatus);
          router.refresh();
        }
      } else {
        const res = await fetch("/api/orders/prep-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: orderIds[0], prepStatus: newStatus }),
        });
        if (res.ok) {
          setStatus(newStatus);
          router.refresh();
        }
      }
    } finally {
      setLoading(false);
    }
  }

  if (status === "SHIPPED") return null;

  return (
    <div className="flex gap-2 pt-1">
      {status === "NEW" && (
        <button
          onClick={() => updateStatus("PREPARING")}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-3 py-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/40 transition-colors"
        >
          <Printer className="h-3.5 w-3.5" />
          Etiqueta impresa
        </button>
      )}
      {status === "PREPARING" && (
        <button
          onClick={() => updateStatus("READY")}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-blue-300 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 px-3 py-1.5 text-[11px] font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/40 transition-colors"
        >
          <PackageCheck className="h-3.5 w-3.5" />
          Listo para Enviar
        </button>
      )}
      {status === "READY" && (
        <button
          onClick={() => updateStatus("SHIPPED")}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-green-300 bg-green-50 dark:bg-green-950/20 dark:border-green-800 px-3 py-1.5 text-[11px] font-medium text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-950/40 transition-colors"
        >
          <Truck className="h-3.5 w-3.5" />
          Marcar Enviado
        </button>
      )}
      {(status === "PREPARING" || status === "READY") && (
        <button
          onClick={() => updateStatus("NEW")}
          disabled={loading}
          className="flex items-center justify-center gap-1 rounded-md border border-border px-2 py-1.5 text-[10px] text-muted-foreground hover:bg-muted transition-colors"
        >
          Regresar
        </button>
      )}
    </div>
  );
}
