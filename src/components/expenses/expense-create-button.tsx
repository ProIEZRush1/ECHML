"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ExpenseFormDialog } from "@/components/expenses/expense-form-dialog";
import { Plus } from "lucide-react";

export function ExpenseCreateButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" data-icon="inline-start" />
        Nuevo Gasto
      </Button>
      <ExpenseFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
