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
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

interface PackOption {
  packId: string;
  packSku: string;
  packName: string;
  income: number;
  withdrawn: number;
  balance: number;
}

interface Allocation {
  packId: string;
  amount: string;
}

interface WithdrawalData {
  id: string;
  amount: string;
  date: string;
  concept: string;
  method: string;
  reference: string | null;
  notes: string | null;
  allocations: Array<{
    packId: string | null;
    amount: string;
  }>;
}

interface WithdrawalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  withdrawal?: WithdrawalData | null;
}

export function WithdrawalFormDialog({
  open,
  onOpenChange,
  withdrawal,
}: WithdrawalFormDialogProps) {
  const router = useRouter();
  const isEditing = !!withdrawal;

  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [concept, setConcept] = useState("");
  const [method, setMethod] = useState("bank");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [productGroupId, setProductGroupId] = useState("");
  const [hasFactura, setHasFactura] = useState(false);
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [packs, setPacks] = useState<PackOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPacks, setLoadingPacks] = useState(false);

  useEffect(() => {
    if (open) {
      fetchPacks();
      if (withdrawal) {
        setAmount(withdrawal.amount);
        setDate(withdrawal.date.split("T")[0]);
        setConcept(withdrawal.concept);
        setMethod(withdrawal.method);
        setReference(withdrawal.reference || "");
        setNotes(withdrawal.notes || "");
        setAllocations(
          withdrawal.allocations
            .filter((a) => a.packId)
            .map((a) => ({
              packId: a.packId!,
              amount: a.amount,
            }))
        );
      } else {
        resetForm();
      }
    }
  }, [open, withdrawal]);

  function resetForm() {
    setAmount("");
    setDate(new Date().toISOString().split("T")[0]);
    setConcept("");
    setMethod("bank");
    setReference("");
    setNotes("");
    setProductGroupId("");
    setHasFactura(false);
    setAllocations([]);
  }

  async function fetchPacks() {
    setLoadingPacks(true);
    try {
      const [cashflowRes, groupsRes] = await Promise.all([
        fetch("/api/cashflow"),
        fetch("/api/product-groups"),
      ]);
      if (cashflowRes.ok) {
        const data = await cashflowRes.json();
        setPacks(data.byPack || []);
      }
      if (groupsRes.ok) {
        setGroups(await groupsRes.json());
      }
    } catch {
      toast.error("Error al cargar datos");
    } finally {
      setLoadingPacks(false);
    }
  }

  function addAllocation() {
    setAllocations([...allocations, { packId: "", amount: "" }]);
  }

  function removeAllocation(index: number) {
    setAllocations(allocations.filter((_, i) => i !== index));
  }

  function updateAllocation(index: number, field: keyof Allocation, value: string) {
    const updated = [...allocations];
    updated[index] = { ...updated[index], [field]: value };
    setAllocations(updated);
  }

  const totalAllocated = allocations.reduce(
    (sum, a) => sum + (parseFloat(a.amount) || 0),
    0
  );
  const totalAmount = parseFloat(amount) || 0;

  async function handleSubmit() {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("El monto debe ser mayor a 0");
      return;
    }
    if (!date) {
      toast.error("La fecha es obligatoria");
      return;
    }
    if (!concept.trim()) {
      toast.error("El concepto es obligatorio");
      return;
    }

    if (totalAllocated > totalAmount) {
      toast.error("Las asignaciones superan el monto total");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        amount: parseFloat(amount),
        date,
        concept: concept.trim(),
        method,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        productGroupId: productGroupId || undefined,
        hasFactura,
        allocations: allocations
          .filter((a) => a.packId && parseFloat(a.amount) > 0)
          .map((a) => ({
            packId: a.packId,
            amount: parseFloat(a.amount),
          })),
      };

      const url = isEditing
        ? `/api/withdrawals/${withdrawal.id}`
        : "/api/withdrawals";
      const method_ = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method: method_,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Error al guardar el retiro");
        return;
      }

      toast.success(
        isEditing ? "Retiro actualizado correctamente" : "Retiro creado correctamente"
      );
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Retiro" : "Nuevo Retiro"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modifica los datos del retiro."
              : "Registra un retiro de Mercado Pago."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="withdrawal-amount">Monto</Label>
              <Input
                id="withdrawal-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="withdrawal-date">Fecha</Label>
              <Input
                id="withdrawal-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="withdrawal-concept">Concepto</Label>
            <Input
              id="withdrawal-concept"
              placeholder="Ej: Retiro semanal"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Metodo</Label>
              <Select value={method} onValueChange={(v) => setMethod(v ?? "bank")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">Banco</SelectItem>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="provider">Proveedor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="withdrawal-reference">Referencia</Label>
              <Input
                id="withdrawal-reference"
                placeholder="Opcional"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="withdrawal-notes">Notas</Label>
            <Textarea
              id="withdrawal-notes"
              placeholder="Notas adicionales..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Grupo</Label>
              <Select value={productGroupId} onValueChange={(v) => setProductGroupId(v === "NONE" ? "" : (v ?? ""))}>
                <SelectTrigger>
                  <SelectValue placeholder="Asignar a grupo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Sin grupo</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Factura</Label>
              <label className="flex items-center gap-2 h-9 px-3 rounded-md border border-input cursor-pointer hover:bg-muted/50">
                <input
                  type="checkbox"
                  checked={hasFactura}
                  onChange={(e) => setHasFactura(e.target.checked)}
                  className="rounded border-input h-4 w-4"
                />
                <span className="text-sm">Factura (3%){hasFactura && totalAmount > 0 ? `: -${formatCurrency(totalAmount * 0.03)}` : ""}</span>
              </label>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Asignaciones por Pack (opcional)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addAllocation}
                disabled={loadingPacks}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Agregar
              </Button>
            </div>

            {allocations.length > 0 && (
              <div className="space-y-2">
                {allocations.map((alloc, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Select
                      value={alloc.packId}
                      onValueChange={(v) => updateAllocation(index, "packId", v ?? "")}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Seleccionar pack..." />
                      </SelectTrigger>
                      <SelectContent>
                        {packs.map((pack) => (
                          <SelectItem key={pack.packId} value={pack.packId}>
                            {pack.packSku}: {pack.packName} (Disp: {formatCurrency(pack.balance)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Monto"
                      className="w-28"
                      value={alloc.amount}
                      onChange={(e) => updateAllocation(index, "amount", e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeAllocation(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                ))}

                <div className="flex items-center justify-between text-sm pt-1">
                  <span className="text-muted-foreground">
                    Asignado: {formatCurrency(totalAllocated)} / {formatCurrency(totalAmount)} total
                  </span>
                  {totalAllocated > totalAmount && (
                    <span className="text-destructive font-medium">Excede el monto</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" data-icon="inline-start" />}
            {isEditing ? "Guardar cambios" : "Crear retiro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
