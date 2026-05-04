"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function MPSyncButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/mp/sync", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setResult(`Error: ${data.error}`);
        return;
      }

      setResult(data.message);
      // Reload page to show updated data
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setResult(`Error de conexion: ${err instanceof Error ? err.message : "desconocido"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button onClick={handleSync} disabled={loading} size="sm">
        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Sincronizando..." : "Sincronizar MP"}
      </Button>
      {result && (
        <span className={`text-xs ${result.startsWith("Error") ? "text-red-500" : "text-green-600 dark:text-green-400"}`}>
          {result}
        </span>
      )}
    </div>
  );
}
