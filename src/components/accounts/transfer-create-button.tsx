"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight } from "lucide-react";
import { TransferFormDialog } from "./transfer-form-dialog";

export function TransferCreateButton() {
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string; color: string }>>([]);

  useEffect(() => {
    if (open && accounts.length === 0) {
      fetch("/api/accounts").then((r) => r.ok ? r.json() : []).then(setAccounts).catch(() => {});
    }
  }, [open, accounts.length]);

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm" variant="outline">
        <ArrowLeftRight className="h-3.5 w-3.5" />
        Pago entre Cuentas
      </Button>
      <TransferFormDialog open={open} onOpenChange={setOpen} accounts={accounts} />
    </>
  );
}
