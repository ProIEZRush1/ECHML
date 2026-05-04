"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { WithdrawalFormDialog } from "@/components/withdrawals/withdrawal-form-dialog";
import { Plus } from "lucide-react";

export function WithdrawalCreateButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" data-icon="inline-start" />
        Nuevo Retiro
      </Button>
      <WithdrawalFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
