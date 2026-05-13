"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

export function SyncStatusButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/orders/sync-status", { method: "POST" });
      if (!res.ok) throw new Error("Sync failed");
      const data = await res.json();
      setResult(`${data.updated} de ${data.checked} actualizados`);
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      setResult("Error al sincronizar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {result && <span className="text-[11px] text-muted-foreground">{result}</span>}
      <button
        onClick={handleSync}
        disabled={loading}
        className="filt-input hover:border-muted-foreground flex items-center gap-1.5"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        <span className="text-[12px]">Actualizar Estados</span>
      </button>
    </div>
  );
}
