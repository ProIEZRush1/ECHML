"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Supplier {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  supplierCode: string;
  variants: Array<{
    id: string;
    color: string;
  }>;
}

interface StockRow {
  productId: string;
  variantId: string;
  quantity: string;
  unitCost: string;
}

const COLOR_LABELS: Record<string, string> = {
  AZUL: "Azul",
  VERDE: "Verde",
  ROSA: "Rosa",
  MORADO: "Morado",
};

export default function StockEntryPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<StockRow[]>([
    { productId: "", variantId: "", quantity: "", unitCost: "" },
  ]);

  useEffect(() => {
    async function loadData() {
      const [suppliersRes, productsRes] = await Promise.all([
        fetch("/api/suppliers"),
        fetch("/api/products"),
      ]);
      if (suppliersRes.ok) setSuppliers(await suppliersRes.json());
      if (productsRes.ok) setProducts(await productsRes.json());
    }
    loadData();
  }, []);

  function addRow() {
    setRows([...rows, { productId: "", variantId: "", quantity: "", unitCost: "" }]);
  }

  function removeRow(index: number) {
    if (rows.length === 1) return;
    setRows(rows.filter((_, i) => i !== index));
  }

  function updateRow(index: number, field: keyof StockRow, value: string) {
    const updated = [...rows];
    updated[index] = { ...updated[index], [field]: value };
    if (field === "productId") {
      updated[index].variantId = "";
    }
    setRows(updated);
  }

  function getVariantsForProduct(productId: string) {
    const product = products.find((p) => p.id === productId);
    return product?.variants ?? [];
  }

  const totalItems = useMemo(() => {
    return rows.reduce((sum, r) => sum + (parseInt(r.quantity, 10) || 0), 0);
  }, [rows]);

  const totalCost = useMemo(() => {
    return rows.reduce((sum, r) => {
      const qty = parseInt(r.quantity, 10) || 0;
      const cost = parseFloat(r.unitCost) || 0;
      return sum + qty * cost;
    }, 0);
  }, [rows]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const items = rows
      .filter((r) => r.variantId && r.quantity)
      .map((r) => ({
        productVariantId: r.variantId,
        quantity: parseInt(r.quantity, 10),
        unitCost: parseFloat(r.unitCost) || 0,
      }));

    if (items.length === 0) {
      toast.error("Agrega al menos un articulo");
      setLoading(false);
      return;
    }

    if (!supplierId) {
      toast.error("Selecciona un proveedor");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/stock/entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierId, notes, items }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Error al registrar entrada");
        return;
      }

      toast.success("Entrada de stock registrada correctamente");
      router.push("/stock");
      router.refresh();
    } catch {
      toast.error("Error de conexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Entrada de Stock"
        description="Registrar nuevas unidades en inventario"
      />

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* General Info Card */}
        <div className="rounded-[9px] border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-[13px] font-semibold">Informacion General</h2>
          </div>
          <div className="p-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                Proveedor
              </label>
              <Select value={supplierId} onValueChange={(v) => setSupplierId(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar proveedor" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                Notas
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas opcionales sobre la entrada..."
                className="resize-none"
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* Items Card */}
        <div className="rounded-[9px] border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-[13px] font-semibold">Articulos</h2>
            <Button type="button" variant="outline" size="sm" onClick={addRow} className="h-7 text-xs gap-1">
              <Plus className="size-3.5" />
              Agregar
            </Button>
          </div>

          {/* Column headers */}
          <div className="entry-row bg-muted/40 !border-b !py-2">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">Producto</span>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">Color</span>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">Cant.</span>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">Costo U.</span>
            <span />
          </div>

          {/* Rows */}
          {rows.map((row, index) => (
            <div key={index} className="entry-row">
              <Select
                value={row.productId}
                onValueChange={(v) => updateRow(index, "productId", v ?? "")}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Producto" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.supplierCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={row.variantId}
                onValueChange={(v) => updateRow(index, "variantId", v ?? "")}
                disabled={!row.productId}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Color" />
                </SelectTrigger>
                <SelectContent>
                  {getVariantsForProduct(row.productId).map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {COLOR_LABELS[v.color] ?? v.color}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="number"
                min="1"
                value={row.quantity}
                onChange={(e) => updateRow(index, "quantity", e.target.value)}
                placeholder="0"
                className="h-9 text-xs mono text-center"
              />

              <Input
                type="number"
                min="0"
                step="0.01"
                value={row.unitCost}
                onChange={(e) => updateRow(index, "unitCost", e.target.value)}
                placeholder="0.00"
                className="h-9 text-xs mono"
              />

              <button
                type="button"
                onClick={() => removeRow(index)}
                disabled={rows.length === 1}
                className="flex items-center justify-center h-9 w-8 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}

          {/* Summary */}
          <div className="summary-line">
            <span className="text-muted-foreground">
              {rows.length} fila{rows.length !== 1 ? "s" : ""} &middot; {totalItems} unidad{totalItems !== 1 ? "es" : ""}
            </span>
            <span className="v">
              ${totalCost.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/stock")}
            className="h-9"
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={loading} className="h-9">
            {loading ? "Registrando..." : "Registrar Entrada"}
          </Button>
        </div>
      </form>
    </div>
  );
}
