"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StockIndicator } from "@/components/shared/stock-indicator";
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
      <p className="text-center text-sm text-muted-foreground py-8">
        No hay packs creados todavia.
      </p>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Composicion</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead className="text-center"># Publicaciones</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {packs.map((pack) => (
              <TableRow key={pack.id} className="hover:bg-muted/50">
                <TableCell>
                  <Link href={`/packs/${pack.id}`} className="font-medium hover:underline">
                    {pack.sku}
                  </Link>
                </TableCell>
                <TableCell>{pack.name}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1">
                    {pack.items.map((item, idx) => (
                      <span key={item.id} className="flex items-center gap-1 text-sm">
                        {idx > 0 && <span className="text-muted-foreground">+</span>}
                        <span>{item.quantity}x</span>
                        <ColorBadge color={item.productVariant.color} showLabel={false} />
                        <span className="text-muted-foreground">
                          ({item.productVariant.product.supplierCode})
                        </span>
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(pack.salePrice)}
                </TableCell>
                <TableCell>
                  <StockIndicator stock={pack.stock} />
                </TableCell>
                <TableCell className="text-center">
                  {pack.mlListings.length}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleEdit(pack)}
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <PackDeleteButton
                      packId={pack.id}
                      packSku={pack.sku}
                      hasListings={pack.mlListings.length > 0}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <PackFormDialog
        open={dialogOpen}
        onOpenChange={handleDialogChange}
        pack={editingPack}
      />
    </>
  );
}
