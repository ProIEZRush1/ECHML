"use client";

import { useState } from "react";
import Link from "next/link";
import { ColorBadge } from "@/components/shared/color-badge";
import { PackFormDialog } from "@/components/packs/pack-form-dialog";
import { PackDeleteButton } from "@/components/packs/pack-delete-button";
import { formatCurrency } from "@/lib/utils";
import { Pencil } from "lucide-react";
import type { PackWithDetails } from "@/types";

interface PackTableProps {
  packs: PackWithDetails[];
}

export function PackTable({ packs }: PackTableProps) {
  const [editingPack, setEditingPack] = useState<PackWithDetails | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  function handleEdit(pack: PackWithDetails) {
    setEditingPack(pack);
    setDialogOpen(true);
  }

  function handleDialogChange(open: boolean) {
    setDialogOpen(open);
    if (!open) setEditingPack(null);
  }

  if (packs.length === 0) {
    return (
      <p className="text-center text-[12.5px] text-muted-foreground py-8">
        No hay packs creados todavia.
      </p>
    );
  }

  return (
    <>
      <div className="rounded-[9px] border border-border bg-card overflow-hidden">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                SKU
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                Nombre
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                Composicion
              </th>
              <th className="px-3 py-2.5 text-right text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                Precio
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                Stock
              </th>
              <th className="px-3 py-2.5 text-center text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                Pub.
              </th>
              <th className="px-3 py-2.5 text-right text-[11px] font-medium text-muted-foreground uppercase tracking-[0.05em]">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {packs.map((pack) => (
              <tr key={pack.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                <td className="px-3 py-2.5">
                  <Link href={`/packs/${pack.id}`} className="mono text-[11.5px] text-muted-foreground hover:underline">
                    {pack.sku}
                  </Link>
                </td>
                <td className="px-3 py-2.5 font-medium">{pack.name}</td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-1">
                    {pack.items.map((item, idx) => (
                      <span key={item.id} className="flex items-center gap-1 text-[12px]">
                        {idx > 0 && <span className="text-muted-foreground">+</span>}
                        <span>{item.quantity}x</span>
                        <ColorBadge
                          color={item.productVariant.color}
                          variantLabel={item.productVariant.variantLabel}
                          showLabel={false}
                        />
                        <span className="mono text-[11px] text-muted-foreground">
                          ({item.productVariant.product.supplierCode})
                        </span>
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right">
                  {formatCurrency(pack.salePrice)}
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={`mono text-[12px] font-semibold ${
                      pack.stock === 0
                        ? "text-destructive"
                        : pack.stock <= 5
                          ? "text-[oklch(0.48_0.13_70)]"
                          : "text-success"
                    }`}
                  >
                    {pack.stock}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-center mono text-[11.5px] text-muted-foreground">
                  {pack.mlListings.length}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => handleEdit(pack)}
                      className="size-7 flex items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <PackDeleteButton
                      packId={pack.id}
                      packSku={pack.sku}
                      hasListings={pack.mlListings.length > 0}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PackFormDialog
        open={dialogOpen}
        onOpenChange={handleDialogChange}
        pack={editingPack}
      />
    </>
  );
}
