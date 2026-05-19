"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Props {
  withdrawalId: string;
  hasFactura: boolean;
}

export function WithdrawalFacturaToggle({ withdrawalId, hasFactura }: Props) {
  const router = useRouter();
  const [checked, setChecked] = useState(hasFactura);
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    const newValue = !checked;
    try {
      const res = await fetch(`/api/withdrawals/${withdrawalId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hasFactura: newValue }),
      });
      if (res.ok) {
        setChecked(newValue);
        toast.success(newValue ? "Factura activada (3%)" : "Factura desactivada");
        router.refresh();
      }
    } catch {
      toast.error("Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px]">
      <input
        type="checkbox"
        checked={checked}
        onChange={handleToggle}
        disabled={loading}
        className="rounded border-input h-3.5 w-3.5"
      />
      <span className="text-muted-foreground">3%</span>
    </label>
  );
}
