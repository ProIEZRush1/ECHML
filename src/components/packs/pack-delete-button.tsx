"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PackDeleteButtonProps {
  packId: string;
  packSku: string;
  hasListings: boolean;
}

export function PackDeleteButton({ packId, packSku, hasListings }: PackDeleteButtonProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch(`/api/packs/${packId}`, { method: "DELETE" });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Error al eliminar el pack");
        return;
      }

      toast.success(`Pack ${packSku} eliminado`);
      router.refresh();
    } catch {
      toast.error("Error de conexion");
    } finally {
      setLoading(false);
      setConfirmOpen(false);
    }
  }

  if (hasListings) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              disabled
            />
          }
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
        </TooltipTrigger>
        <TooltipContent>
          No se puede eliminar porque tiene publicaciones vinculadas
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setConfirmOpen(true)}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
        )}
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Eliminar pack"
        description={`¿Estas seguro de que quieres eliminar el pack "${packSku}"? Esta accion no se puede deshacer.`}
        onConfirm={handleDelete}
        variant="destructive"
      />
    </>
  );
}
