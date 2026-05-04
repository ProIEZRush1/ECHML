"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Unplug } from "lucide-react";

export function DisconnectButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleDisconnect() {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/ml/credentials", {
        method: "DELETE",
      });

      if (res.ok) {
        router.push("/setup/mercadolibre");
        router.refresh();
      }
    } catch {
      // Reset on error
      setConfirming(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="destructive"
        size="sm"
        onClick={handleDisconnect}
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Desconectando...
          </>
        ) : (
          <>
            <Unplug className="mr-2 size-4" />
            {confirming ? "Confirmar desconexion" : "Desconectar"}
          </>
        )}
      </Button>
      {confirming && !loading && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirming(false)}
        >
          Cancelar
        </Button>
      )}
    </div>
  );
}
