"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ManualSaleFormDialog, type ProductOption } from "./manual-sale-form-dialog";

export function ManualSaleCreateButton({ products }: { products: ProductOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Registrar venta
      </Button>
      <ManualSaleFormDialog open={open} onOpenChange={setOpen} products={products} />
    </>
  );
}
