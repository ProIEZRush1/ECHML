"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SupplierOption {
  id: string;
  name: string;
}

interface ExpenseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CATEGORIES = [
  { value: "proveedor", label: "Proveedor" },
  { value: "envio", label: "Envio" },
  { value: "suscripcion", label: "Suscripcion" },
  { value: "publicidad", label: "Publicidad" },
  { value: "otro", label: "Otro" },
];

export function ExpenseFormDialog({ open, onOpenChange }: ExpenseFormDialogProps) {
  const router = useRouter();

  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("");
  const [concept, setConcept] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);

  useEffect(() => {
    if (open) {
      fetchSuppliers();
      resetForm();
    }
  }, [open]);

  function resetForm() {
    setAmount("");
    setDate(new Date().toISOString().split("T")[0]);
    setCategory("");
    setConcept("");
    setSupplierId("");
    setNotes("");
  }

  async function fetchSuppliers() {
    setLoadingSuppliers(true);
    try {
      const res = await fetch("/api/suppliers");
      if (res.ok) {
        const data = await res.json();
        setSuppliers(data);
      }
    } catch {
      toast.error("Error al cargar proveedores");
    } finally {
      setLoadingSuppliers(false);
    }
  }

  async function handleSubmit() {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("El monto debe ser mayor a 0");
      return;
    }
    if (!date) {
      toast.error("La fecha es obligatoria");
      return;
    }
    if (!category) {
      toast.error("La categoria es obligatoria");
      return;
    }
    if (!concept.trim()) {
      toast.error("El concepto es obligatorio");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        amount: parseFloat(amount),
        date,
        category,
        concept: concept.trim(),
        supplierId: supplierId || undefined,
        notes: notes.trim() || undefined,
      };

      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Error al guardar el gasto");
        return;
      }

      toast.success("Gasto creado correctamente");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Error de conexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo Gasto</DialogTitle>
          <DialogDescription>
            Registra un nuevo gasto operativo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="expense-amount">Monto</Label>
              <Input
                id="expense-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expense-date">Fecha</Label>
              <Input
                id="expense-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={(v) => setCategory(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar categoria..." />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expense-concept">Concepto</Label>
            <Input
              id="expense-concept"
              placeholder="Ej: Compra de mercancia"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Proveedor (opcional)</Label>
            {loadingSuppliers ? (
              <div className="flex items-center gap-2 h-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Cargando...</span>
              </div>
            ) : (
              <Select value={supplierId} onValueChange={(v) => setSupplierId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar proveedor..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expense-notes">Notas (opcional)</Label>
            <Textarea
              id="expense-notes"
              placeholder="Notas adicionales..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" data-icon="inline-start" />}
            Crear gasto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
