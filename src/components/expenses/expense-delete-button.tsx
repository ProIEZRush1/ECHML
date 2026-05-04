"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ExpenseDeleteButtonProps {
  expenseId: string;
  expenseConcept: string;
}

export function ExpenseDeleteButton({
  expenseId,
  expenseConcept,
}: ExpenseDeleteButtonProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch(`/api/expenses/${expenseId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Error al eliminar el gasto");
        return;
      }

      toast.success(`Gasto "${expenseConcept}" eliminado`);
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
        title="Eliminar gasto"
        description={`¿Estas seguro de que quieres eliminar el gasto "${expenseConcept}"? Esta accion no se puede deshacer.`}
        onConfirm={handleDelete}
        variant="destructive"
      />
    </>
  );
}
