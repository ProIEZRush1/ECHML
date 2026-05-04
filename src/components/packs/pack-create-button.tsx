"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PackFormDialog } from "@/components/packs/pack-form-dialog";
import { Plus } from "lucide-react";

export function PackCreateButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" data-icon="inline-start" />
        Nuevo Pack
      </Button>
      <PackFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
