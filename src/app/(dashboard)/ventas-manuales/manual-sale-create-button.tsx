"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Search, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

export interface PackOption {
  id: string;
  sku: string;
  name: string;
  salePrice: number;
  units: number; // unidades de producto que contiene el pack
  cost: number; // costo de mercancia del pack
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

export function ManualSaleCreateButton({ packs }: { packs: PackOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [packId, setPackId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [concept, setConcept] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [channel, setChannel] = useState("Efectivo");
  const [notes, setNotes] = useState("");
  const [deductStock, setDeductStock] = useState(true);

  const selectedPack = useMemo(() => packs.find((p) => p.id === packId) || null, [packs, packId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return packs.slice(0, 30);
    return packs
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .slice(0, 30);
  }, [packs, search]);

  const qtyNum = Math.max(1, parseInt(quantity || "1", 10) || 1);
  const amountNum = parseFloat(amount || "0") || 0;
  const estCost = selectedPack ? selectedPack.cost * qtyNum : 0;
  const estNet = amountNum - estCost;

  function pickPack(p: PackOption) {
    setPackId(p.id);
    setConcept("");
    // Sugerir el precio de venta del pack × cantidad (editable)
    setAmount((p.salePrice * qtyNum).toFixed(2));
    setSearch("");
  }

  function clearPack() {
    setPackId("");
    setAmount("");
  }

  function onQtyChange(v: string) {
    setQuantity(v);
    const n = Math.max(1, parseInt(v || "1", 10) || 1);
    if (selectedPack) setAmount((selectedPack.salePrice * n).toFixed(2));
  }

  function reset() {
    setPackId("");
    setSearch("");
    setConcept("");
    setQuantity("1");
    setAmount("");
    setDate(new Date().toISOString().split("T")[0]);
    setChannel("Efectivo");
    setNotes("");
    setDeductStock(true);
  }

  async function submit() {
    if (amountNum <= 0) {
      toast.error("El monto debe ser mayor a 0");
      return;
    }
    if (!packId && !concept.trim()) {
      toast.error("Elige un pack del catalogo o escribe un concepto");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/manual-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packId: packId || undefined,
          concept: concept.trim() || undefined,
          quantity: qtyNum,
          amount: amountNum,
          date,
          channel: channel.trim() || undefined,
          notes: notes.trim() || undefined,
          deductStock: !!packId && deductStock,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Error al registrar la venta");
        return;
      }
      toast.success("Venta manual registrada");
      reset();
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Error de conexion");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="h-4 w-4" />
        Registrar venta
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar venta manual</DialogTitle>
          <DialogDescription>Ventas hechas fuera de MercadoLibre. Entran a flujo de caja.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5">
          {/* Producto / pack */}
          <div className="space-y-1.5">
            <Label className="text-[12px]">Producto (pack del catalogo)</Label>
            {selectedPack ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[12.5px] font-medium truncate">{selectedPack.name}</p>
                  <p className="text-[10.5px] text-muted-foreground">{selectedPack.sku} · {selectedPack.units} u · costo {fmt(selectedPack.cost)}</p>
                </div>
                <Button type="button" variant="ghost" size="sm" className="h-7 text-[11px]" onClick={clearPack}>Cambiar</Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar pack por nombre o SKU..."
                    className="h-8 pl-8 text-sm"
                  />
                </div>
                {search.trim() && (
                  <div className="max-h-44 overflow-y-auto rounded-md border border-border divide-y divide-border">
                    {filtered.length === 0 ? (
                      <p className="px-3 py-2 text-[11.5px] text-muted-foreground">Sin resultados</p>
                    ) : (
                      filtered.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => pickPack(p)}
                          className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-muted/60"
                        >
                          <span className="min-w-0">
                            <span className="block text-[12px] font-medium truncate">{p.name}</span>
                            <span className="block text-[10px] text-muted-foreground">{p.sku} · {fmt(p.salePrice)}</span>
                          </span>
                          <Check className="h-3.5 w-3.5 opacity-0" />
                        </button>
                      ))
                    )}
                  </div>
                )}
                <p className="text-[10.5px] text-muted-foreground">O deja vacio y escribe un concepto libre abajo (sin stock ni costo).</p>
                <Input
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  placeholder="Concepto libre (ej. Venta de muestra)"
                  className="h-8 text-sm"
                />
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px]">Cantidad</Label>
              <Input type="number" min={1} value={quantity} onChange={(e) => onQtyChange(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Monto total recibido</Label>
              <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="h-8 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px]">Fecha</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Canal / metodo</Label>
              <Input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="Efectivo / Transferencia" className="h-8 text-sm" list="manual-sale-channels" />
              <datalist id="manual-sale-channels">
                <option value="Efectivo" />
                <option value="Transferencia" />
                <option value="WhatsApp" />
                <option value="Tienda fisica" />
                <option value="Instagram" />
              </datalist>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12px]">Nota (opcional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Cliente, referencia, etc." className="text-sm min-h-[44px]" />
          </div>

          {/* Descontar inventario */}
          {selectedPack && (
            <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer">
              <input type="checkbox" checked={deductStock} onChange={(e) => setDeductStock(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
              <span className="text-[12px]">Descontar del inventario ({selectedPack.units * qtyNum} u del pack)</span>
            </label>
          )}

          {/* Resumen */}
          {selectedPack && (
            <div className="rounded-md bg-muted/40 px-3 py-2 text-[11.5px] space-y-0.5">
              <div className="flex justify-between"><span className="text-muted-foreground">Monto</span><span className="num">{fmt(amountNum)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Costo mercancia</span><span className="num">-{fmt(estCost)}</span></div>
              <div className="flex justify-between font-semibold"><span>Ganancia</span><span className={`num ${estNet >= 0 ? "margin-good" : "margin-bad"}`}>{fmt(estNet)}</span></div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" disabled={submitting} onClick={submit} className="w-full">
            {submitting ? "Registrando..." : "Registrar venta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
