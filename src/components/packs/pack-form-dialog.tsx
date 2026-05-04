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
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { COLOR_MAP, type ColorKey } from "@/lib/utils";
import type { PackWithDetails } from "@/types";

interface ProductOption {
  id: string;
  name: string;
  supplierCode: string;
  variants: { id: string; color: string; stock: number }[];
}

interface PackItemRow {
  productId: string;
  color: string;
  productVariantId: string;
  quantity: number;
}

interface PackFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pack?: PackWithDetails | null;
}

export function PackFormDialog({ open, onOpenChange, pack }: PackFormDialogProps) {
  const router = useRouter();
  const isEditing = !!pack;

  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<PackItemRow[]>([
    { productId: "", color: "", productVariantId: "", quantity: 1 },
  ]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      fetchProducts();
      if (pack) {
        setSku(pack.sku);
        setName(pack.name);
        setSalePrice(pack.salePrice);
        setDescription(pack.description || "");
        setItems(
          pack.items.map((item) => ({
            productId: item.productVariant.product.id,
            color: item.productVariant.color,
            productVariantId: item.productVariant.id,
            quantity: item.quantity,
          }))
        );
      } else {
        resetForm();
      }
    }
  }, [open, pack]);

  function resetForm() {
    setSku("");
    setName("");
    setSalePrice("");
    setDescription("");
    setItems([{ productId: "", color: "", productVariantId: "", quantity: 1 }]);
    setErrors({});
  }

  async function fetchProducts() {
    setLoadingProducts(true);
    try {
      const res = await fetch("/api/products");
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch {
      toast.error("Error al cargar productos");
    } finally {
      setLoadingProducts(false);
    }
  }

  function addItem() {
    setItems([...items, { productId: "", color: "", productVariantId: "", quantity: 1 }]);
  }

  function removeItem(index: number) {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof PackItemRow, value: string | number) {
    const newItems = [...items];
    const item = { ...newItems[index] };

    if (field === "productId") {
      item.productId = value as string;
      item.color = "";
      item.productVariantId = "";
    } else if (field === "color") {
      item.color = value as string;
      const product = products.find((p) => p.id === item.productId);
      const variant = product?.variants.find((v) => v.color === value);
      item.productVariantId = variant?.id || "";
    } else if (field === "quantity") {
      item.quantity = value as number;
    }

    newItems[index] = item;
    setItems(newItems);
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!sku.trim()) newErrors.sku = "El SKU es obligatorio";
    if (!name.trim()) newErrors.name = "El nombre es obligatorio";
    if (!salePrice || parseFloat(salePrice) < 0)
      newErrors.salePrice = "El precio debe ser mayor o igual a 0";

    const validItems = items.filter((item) => item.productVariantId);
    if (validItems.length === 0) {
      newErrors.items = "Debe incluir al menos un item";
    }

    for (let i = 0; i < items.length; i++) {
      if (!items[i].productId) {
        newErrors[`item_${i}_product`] = "Seleccione un producto";
      }
      if (items[i].productId && !items[i].productVariantId) {
        newErrors[`item_${i}_color`] = "Seleccione un color";
      }
      if (items[i].quantity < 1) {
        newErrors[`item_${i}_quantity`] = "La cantidad debe ser al menos 1";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;

    setLoading(true);
    try {
      const payload = {
        sku: sku.trim(),
        name: name.trim(),
        salePrice: parseFloat(salePrice),
        description: description.trim() || undefined,
        items: items
          .filter((item) => item.productVariantId)
          .map((item) => ({
            productVariantId: item.productVariantId,
            quantity: item.quantity,
          })),
      };

      const url = isEditing ? `/api/packs/${pack.id}` : "/api/packs";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Error al guardar el pack");
        return;
      }

      toast.success(isEditing ? "Pack actualizado correctamente" : "Pack creado correctamente");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Error de conexion");
    } finally {
      setLoading(false);
    }
  }

  function getAvailableColors(productId: string): { id: string; color: string; stock: number }[] {
    const product = products.find((p) => p.id === productId);
    return product?.variants || [];
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Pack" : "Nuevo Pack"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modifica los datos del pack y sus items."
              : "Completa los datos para crear un nuevo pack."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* SKU */}
          <div className="space-y-1.5">
            <Label htmlFor="pack-sku">SKU</Label>
            <Input
              id="pack-sku"
              placeholder="Ej: TM-AZ-2"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              aria-invalid={!!errors.sku}
            />
            {errors.sku && (
              <p className="text-xs text-destructive">{errors.sku}</p>
            )}
          </div>

          {/* Nombre */}
          <div className="space-y-1.5">
            <Label htmlFor="pack-name">Nombre</Label>
            <Input
              id="pack-name"
              placeholder="Ej: Pack Termos Azul x2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Precio */}
          <div className="space-y-1.5">
            <Label htmlFor="pack-price">Precio de venta</Label>
            <Input
              id="pack-price"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              aria-invalid={!!errors.salePrice}
            />
            {errors.salePrice && (
              <p className="text-xs text-destructive">{errors.salePrice}</p>
            )}
          </div>

          {/* Descripcion */}
          <div className="space-y-1.5">
            <Label htmlFor="pack-desc">Descripcion (opcional)</Label>
            <Textarea
              id="pack-desc"
              placeholder="Descripcion del pack..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <Separator />

          {/* Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Composicion del pack</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addItem}
              >
                <Plus className="h-3.5 w-3.5" data-icon="inline-start" />
                Agregar item
              </Button>
            </div>

            {errors.items && (
              <p className="text-xs text-destructive">{errors.items}</p>
            )}

            {loadingProducts ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Cargando productos...
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-end"
                  >
                    {/* Product */}
                    <div className="space-y-1">
                      {index === 0 && (
                        <span className="text-xs text-muted-foreground">Producto</span>
                      )}
                      <Select
                        value={item.productId}
                        onValueChange={(val) => updateItem(index, "productId", val ?? "")}
                      >
                        <SelectTrigger
                          className="w-full"
                          aria-invalid={!!errors[`item_${index}_product`]}
                        >
                          <SelectValue placeholder="Producto..." />
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

                    {/* Color */}
                    <div className="space-y-1">
                      {index === 0 && (
                        <span className="text-xs text-muted-foreground">Color</span>
                      )}
                      <Select
                        value={item.color}
                        onValueChange={(val) => updateItem(index, "color", val ?? "")}
                        disabled={!item.productId}
                      >
                        <SelectTrigger
                          className="w-[100px]"
                          aria-invalid={!!errors[`item_${index}_color`]}
                        >
                          <SelectValue placeholder="Color" />
                        </SelectTrigger>
                        <SelectContent>
                          {getAvailableColors(item.productId).map((v) => (
                            <SelectItem key={v.id} value={v.color}>
                              <span className="flex items-center gap-1.5">
                                <span
                                  className={`inline-block size-2.5 rounded-full ${COLOR_MAP[v.color as ColorKey]?.bg || ""}`}
                                />
                                {COLOR_MAP[v.color as ColorKey]?.label || v.color}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Quantity */}
                    <div className="space-y-1">
                      {index === 0 && (
                        <span className="text-xs text-muted-foreground">Cant.</span>
                      )}
                      <Input
                        type="number"
                        min="1"
                        className="w-[60px]"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(index, "quantity", parseInt(e.target.value) || 1)
                        }
                        aria-invalid={!!errors[`item_${index}_quantity`]}
                      />
                    </div>

                    {/* Remove */}
                    <div>
                      {index === 0 && <span className="block text-xs invisible">X</span>}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeItem(index)}
                        disabled={items.length <= 1}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                ))}
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
            {isEditing ? "Guardar cambios" : "Crear pack"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
