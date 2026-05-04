"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";

interface SyncButtonProps {
  lastSync: string | null;
}

export function SyncButton({ lastSync }: SyncButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/ml/import-listings", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Error al sincronizar");
        return;
      }

      setMessage(data.message);
      router.refresh();
    } catch {
      setMessage("Error de conexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {lastSync && (
        <span className="text-xs text-muted-foreground">
          Ultima sinc: {new Date(lastSync).toLocaleString("es-MX")}
        </span>
      )}
      {message && (
        <span className="text-xs text-muted-foreground">{message}</span>
      )}
      <Button onClick={handleSync} disabled={loading} size="sm">
        {loading ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Sincronizando...
          </>
        ) : (
          <>
            <RefreshCw className="mr-2 size-4" />
            Sincronizar con ML
          </>
        )}
      </Button>
    </div>
  );
}
