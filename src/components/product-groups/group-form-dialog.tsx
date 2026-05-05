"use client";

import { useState, useEffect, useMemo } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";

interface ProductInfo {
  id: string;
  name: string;
  brand: string | null;
}

interface GroupData {
  id: string;
  name: string;
  color: string;
  products: ProductInfo[];
}

interface GroupFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group?: GroupData | null;
}

const PRESET_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#06b6d4",
  "#f59e0b",
  "#ef4444",
  "#10b981",
  "#f97316",
  "#ec4899",
  "#6b7280",
];

export function GroupFormDialog({ open, onOpenChange, group }: GroupFormDialogProps) {
  const router = useRouter();
  const isEditing = !!group;

  const [name, setName] = useState("");
  const [color, setColor] = useState("#6b7280");
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoadingProducts(true); // eslint-disable-line react-hooks/set-state-in-effect
    (async () => {
      try {
        const res = await fetch("/api/products");
        if (cancelled) return;
        const data = res.ok ? await res.json() : [];
        if (cancelled) return;
        setProducts(
          (data || []).map((p: { id: string; name: string; brand: string | null }) => ({
            id: p.id,
            name: p.name,
            brand: p.brand,
          }))
        );
      } catch {
        if (!cancelled) toast.error("Error al cargar productos");
      } finally {
        if (!cancelled) setLoadingProducts(false);
      }
    })();

    if (group) {
      setName(group.name);
      setColor(group.color);
      setSelectedProductIds(new Set(group.products.map((p) => p.id)));
    } else {
      setName("");
      setColor("#6b7280");
      setSelectedProductIds(new Set());
    }
    setSearch("");

    return () => { cancelled = true; };
  }, [open, group]);

  function toggleProduct(id: string) {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const filteredProducts = useMemo(() => {
    if (!search) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.brand && p.brand.toLowerCase().includes(q))
    );
  }, [products, search]);

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("El nombre del grupo es obligatorio");
      return;
    }
    if (selectedProductIds.size === 0) {
      toast.error("Selecciona al menos un producto");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        color,
        productIds: Array.from(selectedProductIds),
      };

      const url = isEditing ? `/api/product-groups/${group.id}` : "/api/product-groups";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Error al guardar el grupo");
        return;
      }

      toast.success(isEditing ? "Grupo actualizado" : "Grupo creado");
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
          <DialogTitle>{isEditing ? "Editar Grupo" : "Nuevo Grupo"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modifica el nombre, color y productos del grupo."
              : "Crea un grupo de productos para filtrado rapido."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Nombre */}
          <div className="space-y-1.5">
            <Label htmlFor="group-name">Nombre</Label>
            <Input
              id="group-name"
              placeholder="Ej: Magnesios Isaac"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    color === c ? "border-foreground scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          {/* Products */}
          <div className="space-y-1.5">
            <Label>
              Productos{" "}
              <span className="text-muted-foreground font-normal">
                ({selectedProductIds.size} seleccionado{selectedProductIds.size !== 1 ? "s" : ""})
              </span>
            </Label>

            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar producto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>

            {loadingProducts ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Cargando...</span>
              </div>
            ) : (
              <div className="border rounded-md max-h-56 overflow-y-auto">
                {filteredProducts.length === 0 ? (
                  <div className="p-3 text-xs text-muted-foreground text-center">
                    Sin resultados
                  </div>
                ) : (
                  filteredProducts.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-muted cursor-pointer border-b last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedProductIds.has(p.id)}
                        onChange={() => toggleProduct(p.id)}
                        className="rounded"
                      />
                      {p.brand && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0 shrink-0">
                          {p.brand}
                        </Badge>
                      )}
                      <span className="text-xs truncate">{p.name}</span>
                    </label>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
            {isEditing ? "Guardar cambios" : "Crear grupo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
