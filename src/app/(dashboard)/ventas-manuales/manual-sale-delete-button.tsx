"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export function ManualSaleDeleteButton({
  saleId,
  label,
  deductedStock,
}: {
  saleId: string;
  label: string;
  deductedStock: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function confirm() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/manual-sales/${saleId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Error al borrar");
        return;
      }
      toast.success("Venta borrada" + (deductedStock ? " · stock devuelto" : ""));
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Error de conexion");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground hover:text-red-600"
        onClick={() => setOpen(true)}
        title="Borrar venta"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Borrar venta manual</DialogTitle>
            <DialogDescription>
              ¿Borrar &ldquo;{label}&rdquo;?{deductedStock ? " Se devolvera el stock descontado al inventario." : ""} Esta accion no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>Cancelar</Button>
            <Button variant="destructive" onClick={confirm} disabled={deleting}>
              {deleting ? "Borrando..." : "Borrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
