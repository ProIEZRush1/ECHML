"use client";

import { useState, useEffect, useRef } from "react";
import { RefreshCw } from "lucide-react";

export function SyncStatusButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const hasAutoSynced = useRef(false);

  async function handleSync(auto = false) {
    setLoading(true);
    if (!auto) setResult(null);
    try {
      const res = await fetch("/api/orders/sync-status", { method: "POST" });
      if (!res.ok) throw new Error("Sync failed");
      const data = await res.json();
      if (data.updated > 0) {
        setResult(`${data.updated} actualizados`);
        setTimeout(() => window.location.reload(), 1000);
      } else if (!auto) {
        setResult("Todo al dia");
      }
    } catch {
      if (!auto) setResult("Error al sincronizar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!hasAutoSynced.current) {
      hasAutoSynced.current = true;
      handleSync(true);
    }
  }, []);

  return (
    <div className="flex items-center gap-2">
      {result && <span className="text-[11px] text-muted-foreground">{result}</span>}
      <button
        onClick={() => handleSync(false)}
        disabled={loading}
        className="filt-input hover:border-muted-foreground flex items-center gap-1.5"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        <span className="text-[12px]">{loading ? "Sincronizando..." : "Actualizar Estados"}</span>
      </button>
    </div>
  );
}
