"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Group {
  id: string;
  name: string;
  color: string;
}

interface Props {
  withdrawalId: string;
  currentGroupId: string | null;
  groups: Group[];
}

export function WithdrawalGroupSelect({ withdrawalId, currentGroupId, groups }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleChange(groupId: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/withdrawals/${withdrawalId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productGroupId: groupId || null }),
      });
      if (!res.ok) throw new Error();
      toast.success("Grupo asignado");
      router.refresh();
    } catch {
      toast.error("Error al asignar grupo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <select
      value={currentGroupId || ""}
      onChange={(e) => handleChange(e.target.value)}
      disabled={loading}
      className="text-[11px] bg-transparent border border-border rounded px-2 py-1 cursor-pointer hover:border-muted-foreground"
    >
      <option value="">Sin grupo</option>
      {groups.map((g) => (
        <option key={g.id} value={g.id}>{g.name}</option>
      ))}
    </select>
  );
}
