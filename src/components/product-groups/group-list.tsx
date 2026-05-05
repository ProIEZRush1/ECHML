"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { GroupFormDialog } from "./group-form-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

interface ProductInfo {
  id: string;
  name: string;
  brand: string | null;
}

interface GroupData {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  products: ProductInfo[];
}

interface GroupListProps {
  groups: GroupData[];
}

export function GroupList({ groups }: GroupListProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GroupData | null>(null);
  const [seeding, setSeeding] = useState(false);

  function handleCreate() {
    setEditingGroup(null);
    setDialogOpen(true);
  }

  function handleEdit(group: GroupData) {
    setEditingGroup(group);
    setDialogOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/product-groups/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Error al eliminar grupo");
        return;
      }
      toast.success("Grupo eliminado");
      router.refresh();
    } catch {
      toast.error("Error de conexion");
    } finally {
      setDeleteTarget(null);
    }
  }

  async function handleSeed() {
    setSeeding(true);
    try {
      const res = await fetch("/api/product-groups/seed", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Error al crear grupos predeterminados");
        return;
      }
      if (data.created?.length > 0) {
        toast.success(`Grupos creados: ${data.created.join(", ")}`);
      } else {
        toast.info("Todos los grupos ya existen");
      }
      router.refresh();
    } catch {
      toast.error("Error de conexion");
    } finally {
      setSeeding(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button onClick={handleCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Nuevo Grupo
        </Button>
        <Button onClick={handleSeed} variant="outline" size="sm" disabled={seeding}>
          {seeding ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-1" />
          )}
          Crear predeterminados
        </Button>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>No hay grupos de productos creados.</p>
            <p className="text-sm mt-1">
              Usa el boton &quot;Crear predeterminados&quot; para generar los grupos iniciales.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map((group) => (
            <Card key={group.id}>
              <CardContent className="pt-4 pb-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: group.color }}
                    />
                    <span className="font-medium text-sm">{group.name}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {group.products.length} producto{group.products.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleEdit(group)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => setDeleteTarget(group)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {group.products.slice(0, 6).map((p) => (
                    <Badge key={p.id} variant="outline" className="text-[10px] font-normal">
                      {p.name.length > 30 ? p.name.slice(0, 30) + "..." : p.name}
                    </Badge>
                  ))}
                  {group.products.length > 6 && (
                    <Badge variant="outline" className="text-[10px] font-normal">
                      +{group.products.length - 6} mas
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <GroupFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        group={editingGroup}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Eliminar grupo"
        description={`Estas seguro que deseas eliminar el grupo "${deleteTarget?.name}"? Esta accion no se puede deshacer.`}
        onConfirm={handleDelete}
        variant="destructive"
      />
    </>
  );
}
