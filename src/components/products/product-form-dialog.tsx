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
import type { ProductWithVariants } from "@/types";

interface SupplierOption {
  id: string;
  name: string;
}

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: ProductWithVariants | null;
}

export function ProductFormDialog({ open, onOpenChange, product }: ProductFormDialogProps) {
  const router = useRouter();
  const isEditing = !!product;

  const [name, setName] = useState("");
  const [supplierCode, setSupplierCode] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [description, setDescription] = useState("");
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      fetchSuppliers();
      if (product) {
        setName(product.name);
        setSupplierCode(product.supplierCode);
        setUnitCost(product.unitCost);
        setSupplierId(product.supplier.id);
        setDescription(product.description || "");
      } else {
        resetForm();
      }
    }
  }, [open, product]);

  function resetForm() {
    setName("");
    setSupplierCode("");
    setUnitCost("");
    setSupplierId("");
    setDescription("");
    setErrors({});
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

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) newErrors.name = "El nombre es obligatorio";
    if (!supplierCode.trim()) newErrors.supplierCode = "El codigo es obligatorio";
    if (!unitCost || parseFloat(unitCost) < 0)
      newErrors.unitCost = "El costo debe ser mayor o igual a 0";
    if (!supplierId) newErrors.supplierId = "El proveedor es obligatorio";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;

    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        supplierCode: supplierCode.trim(),
        unitCost: parseFloat(unitCost),
        supplierId,
        description: description.trim() || undefined,
      };

      const url = isEditing ? `/api/products/${product.id}` : "/api/products";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Error al guardar el producto");
        return;
      }

      toast.success(
        isEditing ? "Producto actualizado correctamente" : "Producto creado correctamente"
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Producto" : "Nuevo Producto"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modifica los datos del producto."
              : "Completa los datos para crear un nuevo producto."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Nombre */}
          <div className="space-y-1.5">
            <Label htmlFor="product-name">Nombre</Label>
            <Input
              id="product-name"
              placeholder="Ej: Termo Stanley 1L"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Codigo proveedor */}
          <div className="space-y-1.5">
            <Label htmlFor="product-code">Codigo proveedor</Label>
            <Input
              id="product-code"
              placeholder="Ej: ST-1000"
              value={supplierCode}
              onChange={(e) => setSupplierCode(e.target.value)}
              aria-invalid={!!errors.supplierCode}
            />
            {errors.supplierCode && (
              <p className="text-xs text-destructive">{errors.supplierCode}</p>
            )}
          </div>

          {/* Costo unitario */}
          <div className="space-y-1.5">
            <Label htmlFor="product-cost">Costo unitario</Label>
            <Input
              id="product-cost"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              aria-invalid={!!errors.unitCost}
            />
            {errors.unitCost && (
              <p className="text-xs text-destructive">{errors.unitCost}</p>
            )}
          </div>

          {/* Proveedor */}
          <div className="space-y-1.5">
            <Label>Proveedor</Label>
            {loadingSuppliers ? (
              <div className="flex items-center gap-2 h-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Cargando...</span>
              </div>
            ) : (
              <Select value={supplierId} onValueChange={(v) => setSupplierId(v ?? "")}>
                <SelectTrigger className="w-full" aria-invalid={!!errors.supplierId}>
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
            {errors.supplierId && (
              <p className="text-xs text-destructive">{errors.supplierId}</p>
            )}
          </div>

          {/* Descripcion */}
          <div className="space-y-1.5">
            <Label htmlFor="product-desc">Descripcion (opcional)</Label>
            <Textarea
              id="product-desc"
              placeholder="Descripcion del producto..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
            {isEditing ? "Guardar cambios" : "Crear producto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
