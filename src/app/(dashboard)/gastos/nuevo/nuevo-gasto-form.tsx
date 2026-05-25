"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PackItem {
  quantity: number;
  productVariant: { color: string | null; variantLabel: string | null; product?: { id: string } };
}

interface Sale {
  id: string;
  mpId: string;
  mlOrderId: string;
  description: string | null;
  amount: number;
  label: string;
  dateCreated: string;
  packId: string | null;
  pack: { id: string; sku: string; name: string; imageUrl: string | null; items: PackItem[] } | null;
  shippingType: "flex" | "normal" | "unknown";
}

interface Option { id: string; name: string; sku?: string }
interface GroupOption { id: string; name: string; productIds: string[] }

interface AccountOption { id: string; name: string; color: string; isDefault: boolean }

interface Props {
  suppliers: Option[];
  products: Option[];
  packs: Option[];
  groups: GroupOption[];
  sales: Sale[];
  accounts: AccountOption[];
}

const CATEGORIES = [
  { value: "proveedor", label: "Proveedor" },
  { value: "envio", label: "Envio" },
  { value: "suscripcion", label: "Suscripcion" },
  { value: "publicidad", label: "Publicidad" },
  { value: "empaque", label: "Empaque" },
  { value: "otro", label: "Otro" },
];

const LABEL_DOT: Record<string, string> = {
  "Blanco": "bg-white border border-gray-300", "Negro": "bg-black", "Gris": "bg-gray-400",
  "Multicolor": "bg-gradient-to-r from-blue-500 via-green-500 to-pink-500",
  "Azul": "bg-blue-500", "Verde": "bg-green-500", "Rosa": "bg-pink-400", "Morado": "bg-purple-500",
};
const ENUM_DOT: Record<string, string> = {
  AZUL: "bg-blue-500", VERDE: "bg-green-500", ROSA: "bg-pink-400", MORADO: "bg-purple-500",
};

export function NuevoGastoForm({ suppliers, products, packs, groups, sales, accounts }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [category, setCategory] = useState("");
  const [expenseType, setExpenseType] = useState("gasto");
  const [supplierId, setSupplierId] = useState("");
  const [productId, setProductId] = useState("");
  const [packId, setPackId] = useState("");
  const [productGroupId, setProductGroupId] = useState("");
  const [notes, setNotes] = useState("");
  const [accountId, setAccountId] = useState(() => accounts.find((a) => a.isDefault)?.id || "");

  const [selectedSaleIds, setSelectedSaleIds] = useState<string[]>([]);
  const [salesSearch, setSalesSearch] = useState("");
  const [salesPackFilter, setSalesPackFilter] = useState("");
  const [salesGroupFilters, setSalesGroupFilters] = useState<string[]>([]);
  const [salesShippingFilter, setSalesShippingFilter] = useState("");
  const [salesDateFrom, setSalesDateFrom] = useState("");
  const [salesDateTo, setSalesDateTo] = useState("");

  const filteredSales = sales.filter((s) => {
    if (salesPackFilter && s.packId !== salesPackFilter) return false;
    if (salesGroupFilters.length > 0) {
      const matchingGroups = groups.filter((g) => salesGroupFilters.includes(g.id));
      const allProductIds = new Set(matchingGroups.flatMap((g) => g.productIds));
      const hasProduct = s.pack?.items?.some((item) => allProductIds.has(item.productVariant.product?.id || ""));
      if (!hasProduct) return false;
    }
    if (salesShippingFilter && s.shippingType !== salesShippingFilter) return false;
    if (salesDateFrom && s.dateCreated < salesDateFrom + "T00:00:00") return false;
    if (salesDateTo && s.dateCreated > salesDateTo + "T23:59:59") return false;
    if (salesSearch) {
      const q = salesSearch.toLowerCase();
      return (
        (s.description || "").toLowerCase().includes(q) ||
        (s.pack?.sku || "").toLowerCase().includes(q) ||
        (s.pack?.name || "").toLowerCase().includes(q) ||
        s.mpId.includes(q)
      );
    }
    return true;
  });

  const uniquePacks = [...new Map(sales.filter((s) => s.pack).map((s) => [s.pack!.id, s.pack!])).values()];

  async function handleSubmit() {
    if (!concept || !amount || !date || !category) {
      toast.error("Completa los campos obligatorios");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept,
          amount: parseFloat(amount),
          date,
          category,
          type: expenseType,
          supplierId: supplierId || undefined,
          productId: productId || undefined,
          packId: packId || undefined,
          productGroupId: productGroupId || undefined,
          transactionIds: selectedSaleIds.length > 0 ? selectedSaleIds.join(",") : undefined,
          notes: notes || undefined,
          accountId: accountId || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Error al crear gasto");
        return;
      }
      toast.success("Gasto creado");
      router.push("/gastos");
    } catch {
      toast.error("Error de conexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {/* Form */}
      <div className="space-y-5 min-w-0">
        <div className="rounded-[9px] border border-border bg-card p-5 space-y-4">
          <h3 className="text-[13px] font-semibold">Datos del Gasto</h3>

          <div className="space-y-1.5">
            <Label className="text-[12px]">Concepto *</Label>
            <Input value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Ej: Uber entrega, Envio proveedor..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px]">Monto *</Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="$0.00" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Fecha *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px]">Categoria *</Label>
              <Select value={category} onValueChange={(v) => setCategory(v || "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar...">
                    {CATEGORIES.find((c) => c.value === category)?.label || "Seleccionar..."}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Tipo</Label>
              <Select value={expenseType} onValueChange={(v) => setExpenseType(v || "gasto")}>
                <SelectTrigger>
                  <SelectValue>
                    {expenseType === "compra" ? "Compra" : expenseType === "registro" ? "Registro" : "Gasto"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gasto">Gasto</SelectItem>
                  <SelectItem value="compra">Compra</SelectItem>
                  <SelectItem value="registro">Registro</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                {expenseType === "registro" ? "NO afecta utilidad, solo queda registrado" : "Se resta de la utilidad en Flujo de Caja"}
              </p>
            </div>
          </div>
          {accounts.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-[12px]">Cuenta</Label>
              <Select value={accountId} onValueChange={(v) => setAccountId(v || "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cuenta...">
                    {(() => {
                      const acc = accounts.find((a) => a.id === accountId);
                      if (!acc) return "Seleccionar cuenta...";
                      return acc.name;
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="rounded-[9px] border border-border bg-card p-5 space-y-4">
          <h3 className="text-[13px] font-semibold">Asignar a (opcional)</h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px]">Producto</Label>
              <Select value={productId} onValueChange={(v) => setProductId(v || "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Producto...">{products.find((p) => p.id === productId)?.name || "Producto..."}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Pack</Label>
              <Select value={packId} onValueChange={(v) => setPackId(v || "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Pack...">{packs.find((p) => p.id === packId)?.name || "Pack..."}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {packs.map((p) => <SelectItem key={p.id} value={p.id}>{p.sku || p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px]">Grupo</Label>
              <Select value={productGroupId} onValueChange={(v) => setProductGroupId(v || "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Grupo...">{groups.find((g) => g.id === productGroupId)?.name || "Grupo..."}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Proveedor</Label>
              <Select value={supplierId} onValueChange={(v) => setSupplierId(v || "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Proveedor...">{suppliers.find((s) => s.id === supplierId)?.name || "Proveedor..."}</SelectValue>
                </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12px]">Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas adicionales..." rows={3} />
          </div>
        </div>

        <Button onClick={handleSubmit} disabled={loading} className="w-full" size="lg">
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Crear Gasto
        </Button>
      </div>

      {/* Sales Picker */}
      <div className="space-y-3 min-w-0">
        <div className="rounded-[9px] border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-semibold">
              Asignar a Ventas
              {selectedSaleIds.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">{selectedSaleIds.length}</Badge>
              )}
            </h3>
            {selectedSaleIds.length > 0 && (
              <button onClick={() => setSelectedSaleIds([])} className="text-[11px] text-muted-foreground hover:text-foreground">
                Limpiar
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar producto, SKU, ML ID..."
                value={salesSearch}
                onChange={(e) => setSalesSearch(e.target.value)}
                className="pl-8 h-9 text-xs"
              />
            </div>
            <Select value={salesShippingFilter} onValueChange={(v) => setSalesShippingFilter(v === "ALL" ? "" : (v || ""))}>
              <SelectTrigger className="h-9 text-xs w-24">
                <SelectValue placeholder="Envio">{salesShippingFilter === "flex" ? "Flex" : salesShippingFilter === "normal" ? "ME2" : "Envio"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="flex">Flex</SelectItem>
                <SelectItem value="normal">Normal (ME2)</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={salesDateFrom} onChange={(e) => setSalesDateFrom(e.target.value)} className="h-9 text-xs w-28" />
            <Input type="date" value={salesDateTo} onChange={(e) => setSalesDateTo(e.target.value)} className="h-9 text-xs w-28" />
          </div>

          {/* Group toggle buttons */}
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setSalesGroupFilters([])}
              className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${salesGroupFilters.length === 0 ? "bg-foreground text-background border-foreground" : "border-border hover:border-muted-foreground"}`}
            >Todos</button>
            {groups.map((g) => {
              const isOn = salesGroupFilters.includes(g.id);
              return (
                <button
                  key={g.id}
                  onClick={() => setSalesGroupFilters((prev) => prev.includes(g.id) ? prev.filter((x) => x !== g.id) : [...prev, g.id])}
                  className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${isOn ? "font-semibold" : "border-border hover:border-muted-foreground"}`}
                  style={isOn ? { background: (g as GroupOption & { color?: string }).color ? (g as GroupOption & { color?: string }).color + "20" : undefined } : {}}
                >{g.name}{isOn && salesGroupFilters.length > 1 && <span className="ml-0.5 opacity-50">x</span>}</button>
              );
            })}
          </div>

          <p className="text-[11px] text-muted-foreground">
            {filteredSales.length} ventas{salesSearch || salesGroupFilters.length > 0 || salesDateFrom ? " (filtrado)" : ""}
          </p>
        </div>

        {/* Sales List */}
        <div className="rounded-[9px] border border-border bg-card overflow-hidden">
          <div className="max-h-[calc(100vh-280px)] overflow-y-auto divide-y">
            {filteredSales.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">No hay ventas que coincidan</p>
            ) : (
              filteredSales.map((sale) => {
                const checked = selectedSaleIds.includes(sale.id);
                return (
                  <label
                    key={sale.id}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50 ${checked ? "bg-primary/5 border-l-3 border-l-primary" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedSaleIds((prev) =>
                          checked ? prev.filter((id) => id !== sale.id) : [...prev, sale.id]
                        )
                      }
                      className="rounded border-input h-4 w-4 shrink-0 mt-1"
                    />
                    {sale.pack?.imageUrl && (
                      <img src={sale.pack.imageUrl} alt="" className="h-10 w-10 rounded-md object-cover shrink-0 border bg-muted" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-bold text-green-600 dark:text-green-400">
                          ${sale.amount.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                        </span>
                        {sale.pack && (
                          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded truncate max-w-[150px]">{sale.pack.name}</span>
                        )}
                        {sale.shippingType === "flex" && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">FLEX</span>
                        )}
                        {sale.shippingType === "normal" && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">ME2</span>
                        )}
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(sale.dateCreated).toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-[12px] text-muted-foreground truncate mt-0.5">
                        {sale.description || `Venta #${sale.mpId}`}
                      </p>
                      {sale.pack?.items && sale.pack.items.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {sale.pack.items.map((item, idx) => {
                            const dotClass = (item.productVariant.color && ENUM_DOT[item.productVariant.color])
                              || (item.productVariant.variantLabel && LABEL_DOT[item.productVariant.variantLabel.split(" / ")[0]]);
                            const label = item.productVariant.variantLabel || item.productVariant.color || "";
                            return (
                              <span key={idx} className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                {dotClass && <span className={`inline-block h-2.5 w-2.5 rounded-full ${dotClass}`} />}
                                {item.quantity > 1 && <span>×{item.quantity}</span>}
                                {!dotClass && label && <span>{label}</span>}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
