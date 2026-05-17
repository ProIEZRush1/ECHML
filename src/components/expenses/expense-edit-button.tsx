"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface ExpenseEditButtonProps {
  expense: {
    id: string;
    type: string;
    amount: number;
    date: string;
    category: string;
    concept: string;
  };
}

export function ExpenseEditButton({ expense }: ExpenseEditButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState(String(expense.amount));
  const [concept, setConcept] = useState(expense.concept);
  const [date, setDate] = useState(expense.date.split("T")[0]);
  const [category, setCategory] = useState(expense.category);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/expenses/${expense.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount),
          concept,
          date,
          category,
        }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      toast.success("Gasto actualizado");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Error al actualizar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        title="Editar"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Editar {expense.type === "compra" ? "Compra" : "Gasto"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="edit-amount">Monto</Label>
              <Input id="edit-amount" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="edit-concept">Concepto</Label>
              <Input id="edit-concept" value={concept} onChange={(e) => setConcept(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="edit-date">Fecha</Label>
              <Input id="edit-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="edit-category">Categoria</Label>
              <select
                id="edit-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                <option value="proveedor">Proveedor</option>
                <option value="envio">Envio</option>
                <option value="suscripcion">Suscripcion</option>
                <option value="publicidad">Publicidad</option>
                <option value="empaque">Empaque</option>
                <option value="otro">Otro</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
