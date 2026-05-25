"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { AccountFormDialog } from "./account-form-dialog";

export function AccountCreateButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm">
        <Plus className="h-3.5 w-3.5" />
        Nueva Cuenta
      </Button>
      <AccountFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
