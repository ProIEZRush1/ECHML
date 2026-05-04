"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ProductFormDialog } from "@/components/products/product-form-dialog";
import { Plus } from "lucide-react";

export function ProductCreateButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" data-icon="inline-start" />
        Nuevo Producto
      </Button>
      <ProductFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
