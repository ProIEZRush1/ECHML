"use client";

import { useState, useEffect, useRef } from "react";
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
import { formatCurrency } from "@/lib/utils";

interface PackOption {
  packId: string;
  packSku: string;
  packName: string;
}

interface ProductOption {
  id: string;
  name: string;
  supplierCode: string | null;
}

interface WithdrawalData {
  id: string;
  amount: string;
  date: string;
  concept: string;
  method: string;
  reference: string | null;
  notes: string | null;
  productGroupId: string | null;
  hasFactura: boolean;
  allocations: Array<{
    packId: string | null;
    productId: string | null;
    amount: string;
  }>;
}

interface WithdrawalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  withdrawal?: WithdrawalData | null;
}

function SearchableDropdown({
  label,
  placeholder,
  searchPlaceholder,
  items,
  value,
  onChange,
  renderItem,
  renderSelected,
}: {
  label: string;
  placeholder: string;
  searchPlaceholder: string;
  items: Array<{ id: string }>;
  value: string;
  onChange: (id: string) => void;
  renderItem: (item: any) => string;
  renderSelected: (item: any) => string;
}) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = items.filter((item) =>
    renderItem(item).toLowerCase().includes(search.toLowerCase())
  );

  const selected = items.find((i) => i.id === value);

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div ref={ref} className="relative">
        <Input
          placeholder={selected ? renderSelected(selected) : placeholder}
          value={isOpen ? search : selected ? renderSelected(selected) : ""}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            setSearch("");
          }}
          className={selected && !isOpen ? "text-foreground" : ""}
        />
        {value && !isOpen && (
          <button
            type="button"
            onClick={() => { onChange(""); setSearch(""); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
          >
            x
          </button>
        )}
        {isOpen && (
          <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
            {filtered.length === 0 ? (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">Sin resultados</p>
            ) : (
              filtered.slice(0, 50).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted truncate"
                  onClick={() => {
                    onChange(item.id);
                    setIsOpen(false);
                    setSearch("");
                  }}
                >
                  {renderItem(item)}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
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
  const [productGroupId, setProductGroupId] = useState("");
  const [hasFactura, setHasFactura] = useState(false);
  const [packId, setPackId] = useState("");
  const [productId, setProductId] = useState("");
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [packs, setPacks] = useState<PackOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);

  useEffect(() => {
    if (open) {
      fetchOptions();
      if (withdrawal) {
        setAmount(withdrawal.amount);
        setDate(withdrawal.date.split("T")[0]);
        setConcept(withdrawal.concept);
        setMethod(withdrawal.method);
        setReference(withdrawal.reference || "");
        setNotes(withdrawal.notes || "");
        setProductGroupId(withdrawal.productGroupId || "");
        setHasFactura(withdrawal.hasFactura || false);
        const packAlloc = withdrawal.allocations.find((a) => a.packId);
        const prodAlloc = withdrawal.allocations.find((a) => a.productId);
        setPackId(packAlloc?.packId || "");
        setProductId(prodAlloc?.productId || "");
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
    setPackId("");
    setProductId("");
  }

  async function fetchOptions() {
    setLoadingOptions(true);
    try {
      const [cashflowRes, groupsRes, productsRes] = await Promise.all([
        fetch("/api/cashflow"),
        fetch("/api/product-groups"),
        fetch("/api/products?all=true"),
      ]);
      if (cashflowRes.ok) {
        const data = await cashflowRes.json();
        setPacks(data.byPack || []);
      }
      if (groupsRes.ok) {
        setGroups(await groupsRes.json());
      }
      if (productsRes.ok) {
        const data = await productsRes.json();
        setProducts(Array.isArray(data) ? data : data.products || []);
      }
    } catch {
      toast.error("Error al cargar datos");
    } finally {
      setLoadingOptions(false);
    }
  }

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

    setLoading(true);
    try {
      const allocations: Array<{ packId?: string; productId?: string; amount: number }> = [];
      if (packId) {
        allocations.push({ packId, amount: totalAmount });
      }
      if (productId) {
        allocations.push({ productId, amount: totalAmount });
      }

      const payload = {
        amount: totalAmount,
        date,
        concept: concept.trim(),
        method,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        productGroupId: productGroupId || undefined,
        hasFactura,
        allocations: allocations.length > 0 ? allocations : undefined,
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

          {loadingOptions ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Cargando opciones...
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <SearchableDropdown
                label="Pack"
                placeholder="Buscar pack..."
                searchPlaceholder="Escribir para buscar..."
                items={packs.map((p) => ({ id: p.packId, ...p }))}
                value={packId}
                onChange={setPackId}
                renderItem={(p: PackOption & { id: string }) => `${p.packSku}: ${p.packName}`}
                renderSelected={(p: PackOption & { id: string }) => p.packSku}
              />
              <SearchableDropdown
                label="Producto"
                placeholder="Buscar producto..."
                searchPlaceholder="Escribir para buscar..."
                items={products}
                value={productId}
                onChange={setProductId}
                renderItem={(p: ProductOption) => `${p.supplierCode || ""} ${p.name}`.trim()}
                renderSelected={(p: ProductOption) => p.name}
              />
            </div>
          )}
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
