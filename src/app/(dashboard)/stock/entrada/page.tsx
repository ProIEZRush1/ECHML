"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="space-y-6">
      <PageHeader
        title="Entrada de Stock"
        description="Registrar nuevas unidades en inventario"
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Informacion General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="supplier">Proveedor</Label>
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
            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas opcionales sobre la entrada..."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Articulos</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus className="mr-1 size-4" />
              Agregar fila
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {rows.map((row, index) => (
              <div key={index} className="grid grid-cols-[1fr_1fr_100px_100px_auto] gap-3 items-end">
                <div className="space-y-1">
                  {index === 0 && <Label>Producto</Label>}
                  <Select
                    value={row.productId}
                    onValueChange={(v) => updateRow(index, "productId", v ?? "")}
                  >
                    <SelectTrigger>
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
                </div>
                <div className="space-y-1">
                  {index === 0 && <Label>Color</Label>}
                  <Select
                    value={row.variantId}
                    onValueChange={(v) => updateRow(index, "variantId", v ?? "")}
                    disabled={!row.productId}
                  >
                    <SelectTrigger>
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
                </div>
                <div className="space-y-1">
                  {index === 0 && <Label>Cantidad</Label>}
                  <Input
                    type="number"
                    min="1"
                    value={row.quantity}
                    onChange={(e) => updateRow(index, "quantity", e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  {index === 0 && <Label>Costo Unit.</Label>}
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.unitCost}
                    onChange={(e) => updateRow(index, "unitCost", e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRow(index)}
                    disabled={rows.length === 1}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={loading}>
            {loading ? "Registrando..." : "Registrar Entrada"}
          </Button>
        </div>
      </form>
    </div>
  );
}
