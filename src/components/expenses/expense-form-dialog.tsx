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
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface Option {
  id: string;
  name: string;
  sku?: string;
}

interface SaleTransaction {
  id: string;
  mpId: string;
  description: string | null;
  amount: number;
  dateCreated: string;
  pack: { id: string; sku: string; name: string } | null;
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
  { value: "empaque", label: "Empaque" },
  { value: "otro", label: "Otro" },
];

export function ExpenseFormDialog({ open, onOpenChange }: ExpenseFormDialogProps) {
  const router = useRouter();

  const [expenseType, setExpenseType] = useState("gasto");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("");
  const [concept, setConcept] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [productId, setProductId] = useState("");
  const [packId, setPackId] = useState("");
  const [productGroupId, setProductGroupId] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedSaleIds, setSelectedSaleIds] = useState<string[]>([]);
  const [salesSearch, setSalesSearch] = useState("");

  const [suppliers, setSuppliers] = useState<Option[]>([]);
  const [products, setProducts] = useState<Option[]>([]);
  const [packs, setPacks] = useState<Option[]>([]);
  const [groups, setGroups] = useState<Option[]>([]);
  const [sales, setSales] = useState<SaleTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);

  useEffect(() => {
    if (open) {
      fetchOptions();
      resetForm();
    }
  }, [open]);

  function resetForm() {
    setExpenseType("gasto");
    setAmount("");
    setDate(new Date().toISOString().split("T")[0]);
    setCategory("");
    setConcept("");
    setSupplierId("");
    setProductId("");
    setPackId("");
    setProductGroupId("");
    setNotes("");
    setSelectedSaleIds([]);
    setSalesSearch("");
  }

  async function fetchOptions() {
    setLoadingOptions(true);
    try {
      const [suppRes, prodRes, packRes, groupRes, salesRes] = await Promise.all([
        fetch("/api/suppliers"),
        fetch("/api/products"),
        fetch("/api/packs"),
        fetch("/api/product-groups"),
        fetch("/api/mp/transactions?label=sale&limit=50"),
      ]);
      if (suppRes.ok) setSuppliers(await suppRes.json());
      if (prodRes.ok) {
        const data = await prodRes.json();
        setProducts(data.map((p: Record<string, string>) => ({ id: p.id, name: p.name })));
      }
      if (packRes.ok) {
        const data = await packRes.json();
        setPacks(data.map((p: Record<string, string>) => ({ id: p.id, name: p.name, sku: p.sku })));
      }
      if (groupRes.ok) setGroups(await groupRes.json());
      if (salesRes.ok) {
        const data = await salesRes.json();
        setSales(data.transactions || []);
      }
    } catch {
      toast.error("Error al cargar opciones");
    } finally {
      setLoadingOptions(false);
    }
  }

  async function handleSubmit() {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("El monto debe ser mayor a 0");
      return;
    }
    if (!date || !category || !concept.trim()) {
      toast.error("Fecha, categoria y concepto son obligatorios");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        type: expenseType,
        amount: parseFloat(amount),
        date,
        category,
        concept: concept.trim(),
        supplierId: supplierId || undefined,
        productId: productId || undefined,
        packId: packId || undefined,
        productGroupId: productGroupId || undefined,
        transactionIds: selectedSaleIds.length > 0 ? selectedSaleIds.join(",") : undefined,
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
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Nuevo Gasto</DialogTitle>
          <DialogDescription>Registra un nuevo gasto operativo.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 overflow-y-auto overflow-x-hidden flex-1 min-h-0">
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setExpenseType("gasto")} className={`flex-1 px-3 py-2 text-sm rounded-md border transition-colors ${expenseType === "gasto" ? "bg-rose-50 border-rose-300 text-rose-700 dark:bg-rose-900/30 dark:border-rose-700 dark:text-rose-300" : "bg-background border-input text-muted-foreground"}`}>
                Gasto Operativo
              </button>
              <button type="button" onClick={() => setExpenseType("compra")} className={`flex-1 px-3 py-2 text-sm rounded-md border transition-colors ${expenseType === "compra" ? "bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300" : "bg-background border-input text-muted-foreground"}`}>
                Compra de Productos
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {expenseType === "gasto" ? "Aparece en Flujo de Caja como deduccion" : "No aparece en Flujo de Caja (solo registro de compra)"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="expense-amount">Monto</Label>
              <Input id="expense-amount" type="number" step="0.01" min="0" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expense-date">Fecha</Label>
              <Input id="expense-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expense-concept">Concepto</Label>
            <Input id="expense-concept" placeholder="Ej: Compra de mercancia" value={concept} onChange={(e) => setConcept(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Asignar a (opcional)</Label>
            <div className="grid grid-cols-1 gap-2">
              {loadingOptions ? (
                <div className="flex items-center gap-2 h-8">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Cargando...</span>
                </div>
              ) : (
                <>
                  <Select value={productId} onValueChange={(v) => setProductId(v ?? "")}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Producto..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin producto</SelectItem>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={packId} onValueChange={(v) => setPackId(v ?? "")}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pack..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin pack</SelectItem>
                      {packs.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.sku ? `${p.sku} — ` : ""}{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={productGroupId} onValueChange={(v) => setProductGroupId(v ?? "")}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Grupo..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin grupo</SelectItem>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">
              Asignar a ventas (opcional)
              {selectedSaleIds.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {selectedSaleIds.length}
                </Badge>
              )}
            </Label>
            {loadingOptions ? (
              <div className="flex items-center gap-2 h-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Cargando...</span>
              </div>
            ) : sales.length > 0 ? (
              <div className="space-y-1.5">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar venta..."
                    value={salesSearch}
                    onChange={(e) => setSalesSearch(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto overflow-x-hidden rounded-md border divide-y">
                  {sales
                    .filter((s) => {
                      if (!salesSearch) return true;
                      const q = salesSearch.toLowerCase();
                      return (
                        (s.description || "").toLowerCase().includes(q) ||
                        (s.pack?.sku || "").toLowerCase().includes(q) ||
                        (s.pack?.name || "").toLowerCase().includes(q) ||
                        s.mpId.includes(q)
                      );
                    })
                    .map((sale) => {
                      const checked = selectedSaleIds.includes(sale.id);
                      return (
                        <label
                          key={sale.id}
                          className={`flex items-start gap-2.5 px-3 py-2 cursor-pointer transition-colors hover:bg-muted/50 ${checked ? "bg-primary/10 border-l-2 border-l-primary" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setSelectedSaleIds((prev) =>
                                checked ? prev.filter((id) => id !== sale.id) : [...prev, sale.id]
                              )
                            }
                            className="rounded border-input h-4 w-4 shrink-0 mt-0.5"
                          />
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-bold text-green-600 dark:text-green-400 shrink-0">
                                ${sale.amount.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                              </span>
                              {sale.pack?.sku && (
                                <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded max-w-[100px] truncate">{sale.pack.sku}</span>
                              )}
                              <span className="text-[11px] text-muted-foreground shrink-0">
                                {new Date(sale.dateCreated).toLocaleDateString("es-MX")}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {sale.description || `Venta #${sale.mpId}`}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                </div>
                {selectedSaleIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedSaleIds([])}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Limpiar seleccion
                  </button>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No hay ventas recientes</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Proveedor (opcional)</Label>
            <Select value={supplierId} onValueChange={(v) => setSupplierId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar proveedor..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin proveedor</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expense-notes">Notas (opcional)</Label>
            <Textarea id="expense-notes" placeholder="Notas adicionales..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" data-icon="inline-start" />}
            Crear gasto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
