"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ManualSaleFormDialog, type ProductOption, type ManualSaleEditData } from "./manual-sale-form-dialog";

export function ManualSaleEditButton({
  products,
  sale,
}: {
  products: ProductOption[];
  sale: ManualSaleEditData;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
        title="Editar venta"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <ManualSaleFormDialog open={open} onOpenChange={setOpen} products={products} sale={sale} />
    </>
  );
}
