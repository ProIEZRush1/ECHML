"use client";

import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StockIndicator } from "@/components/shared/stock-indicator";
import { ColorBadge } from "@/components/shared/color-badge";
import { formatCurrency } from "@/lib/utils";
import type { PackWithDetails } from "@/types";

interface PackTableProps {
  packs: PackWithDetails[];
}

export function PackTable({ packs }: PackTableProps) {
  if (packs.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-8">
        No hay packs creados todavia.
      </p>
    );
  }

  return (
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
          </TableRow>
        </TableHeader>
        <TableBody>
          {packs.map((pack) => (
            <TableRow key={pack.id} className="cursor-pointer hover:bg-muted/50">
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
