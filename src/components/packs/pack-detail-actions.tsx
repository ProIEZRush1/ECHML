"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PackFormDialog } from "@/components/packs/pack-form-dialog";
import { PackDeleteButton } from "@/components/packs/pack-delete-button";
import { Pencil } from "lucide-react";
import type { PackWithDetails } from "@/types";

interface PackDetailActionsProps {
  pack: PackWithDetails;
}

export function PackDetailActions({ pack }: PackDetailActionsProps) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={() => setEditOpen(true)}>
        <Pencil className="h-3.5 w-3.5" data-icon="inline-start" />
        Editar
      </Button>
      <PackDeleteButton
        packId={pack.id}
        packSku={pack.sku}
        hasListings={pack.mlListings.length > 0}
      />
      <PackFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        pack={pack}
      />
    </div>
  );
}
