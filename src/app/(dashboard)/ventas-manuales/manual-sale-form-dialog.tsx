"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
} from "@/components/ui/dialog";

export interface VariantOption {
  id: string;
  label: string;
  stock: number;
}
export interface ProductOption {
  id: string;
  name: string;
  unitCost: number;
  variants: VariantOption[];
}
export interface ManualSaleEditData {
  id: string;
  productVariantId: string | null;
  packId: string | null;
  quantity: number;
  amount: number;
  date: string; // yyyy-mm-dd
  channel: string | null;
  deductedStock: boolean;
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

const selectCls =
  "h-8 w-full rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

export function ManualSaleFormDialog({
  open,
  onOpenChange,
  products,
  sale,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  products: ProductOption[];
  sale?: ManualSaleEditData | null;
}) {
  const router = useRouter();
  const isEdit = !!sale;

  const [mode, setMode] = useState<"producto" | "libre">("producto");
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [concept, setConcept] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [channel, setChannel] = useState("Efectivo");
  const [notes, setNotes] = useState("");
  const [deductStock, setDeductStock] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (sale) {
      if (sale.productVariantId) {
        const prod = products.find((p) => p.variants.some((v) => v.id === sale.productVariantId));
        setMode("producto");
        setProductId(prod?.id || "");
        setVariantId(sale.productVariantId);
      } else {
        setMode("libre");
        setProductId("");
        setVariantId("");
      }
      setConcept("");
      setQuantity(String(sale.quantity));
      setAmount(String(sale.amount));
      setDate(sale.date);
      setChannel(sale.channel || "");
      setNotes("");
      setDeductStock(sale.deductedStock);
    } else {
      setMode("producto");
      setProductId("");
      setVariantId("");
      setConcept("");
      setQuantity("1");
      setAmount("");
      setDate(new Date().toISOString().split("T")[0]);
      setChannel("Efectivo");
      setNotes("");
      setDeductStock(true);
    }
  }, [open, sale, products]);

  const product = useMemo(() => products.find((p) => p.id === productId) || null, [products, productId]);
  const variant = useMemo(() => product?.variants.find((v) => v.id === variantId) || null, [product, variantId]);

  const qtyNum = Math.max(1, parseInt(quantity || "1", 10) || 1);
  const amountNum = parseFloat(amount || "0") || 0;
  const estCost = mode === "producto" && product ? product.unitCost * qtyNum : 0;
  const estNet = amountNum - estCost;

  function onProductChange(id: string) {
    setProductId(id);
    setVariantId(""); // reset variante al cambiar de producto
  }

  async function submit() {
    if (amountNum <= 0) {
      toast.error("El monto debe ser mayor a 0");
      return;
    }
    if (mode === "producto" && !variantId) {
      toast.error("Elige el producto y la variante");
      return;
    }
    if (mode === "libre" && !concept.trim()) {
      toast.error("Escribe un concepto");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        productVariantId: mode === "producto" ? variantId : undefined,
        concept: mode === "libre" ? concept.trim() : undefined,
        quantity: qtyNum,
        amount: amountNum,
        date,
        channel: channel.trim() || undefined,
        notes: notes.trim() || undefined,
        deductStock: mode === "producto" ? deductStock : false,
      };
      const res = await fetch(isEdit ? `/api/manual-sales/${sale!.id}` : "/api/manual-sales", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || "Error al guardar");
        return;
      }
      toast.success(isEdit ? "Venta actualizada" : "Venta registrada");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Error de conexion");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar venta manual" : "Registrar venta manual"}</DialogTitle>
          <DialogDescription>Ventas hechas fuera de MercadoLibre. Entran a flujo de caja.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5">
          {/* Modo */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("producto")}
              className={`h-8 rounded-md text-[12px] font-medium border ${mode === "producto" ? "border-accent bg-accent/15 text-accent-foreground" : "border-border text-muted-foreground"}`}
            >
              Producto del catálogo
            </button>
            <button
              type="button"
              onClick={() => setMode("libre")}
              className={`h-8 rounded-md text-[12px] font-medium border ${mode === "libre" ? "border-accent bg-accent/15 text-accent-foreground" : "border-border text-muted-foreground"}`}
            >
              Concepto libre
            </button>
          </div>

          {mode === "producto" ? (
            <>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Producto</Label>
                <select className={selectCls} value={productId} onChange={(e) => onProductChange(e.target.value)}>
                  <option value="">Elige un producto…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Variante (color / talla)</Label>
                <select className={selectCls} value={variantId} onChange={(e) => setVariantId(e.target.value)} disabled={!product}>
                  <option value="">{product ? "Elige una variante…" : "Primero elige el producto"}</option>
                  {product?.variants.map((v) => (
                    <option key={v.id} value={v.id}>{v.label} — {v.stock} en stock</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-[12px]">Concepto</Label>
              <Input value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Ej. Venta de muestra" className="h-8 text-sm" />
              <p className="text-[10.5px] text-muted-foreground">Sin descuento de inventario ni costo.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px]">Cantidad</Label>
              <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="h-8 text-sm" />
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
              <Label className="text-[12px]">Canal / método</Label>
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

          {mode === "producto" && variant && (
            <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer">
              <input type="checkbox" checked={deductStock} onChange={(e) => setDeductStock(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
              <span className="text-[12px]">Descontar del inventario ({qtyNum} u de {variant.label})</span>
            </label>
          )}

          {mode === "producto" && product && (
            <div className="rounded-md bg-muted/40 px-3 py-2 text-[11.5px] space-y-0.5">
              <div className="flex justify-between"><span className="text-muted-foreground">Monto</span><span className="num">{fmt(amountNum)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Costo mercancía ({qtyNum}×{fmt(product.unitCost)})</span><span className="num">-{fmt(estCost)}</span></div>
              <div className="flex justify-between font-semibold"><span>Ganancia</span><span className={`num ${estNet >= 0 ? "margin-good" : "margin-bad"}`}>{fmt(estNet)}</span></div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" disabled={submitting} onClick={submit} className="w-full">
            {submitting ? "Guardando..." : isEdit ? "Guardar cambios" : "Registrar venta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
