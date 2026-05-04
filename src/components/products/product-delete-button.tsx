"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ProductDeleteButtonProps {
  productId: string;
  productName: string;
}

export function ProductDeleteButton({ productId, productName }: ProductDeleteButtonProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch(`/api/products/${productId}`, { method: "DELETE" });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Error al eliminar el producto");
        return;
      }

      toast.success(`Producto "${productName}" eliminado`);
      router.refresh();
    } catch {
      toast.error("Error de conexion");
    } finally {
      setLoading(false);
      setConfirmOpen(false);
    }
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
        title="Eliminar producto"
        description={`¿Estas seguro de que quieres eliminar "${productName}"? Se eliminaran todas sus variantes. Esta accion no se puede deshacer.`}
        onConfirm={handleDelete}
        variant="destructive"
      />
    </>
  );
}
