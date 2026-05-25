"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface Account {
  id: string;
  name: string;
  color: string;
}

interface WithdrawalEditButtonProps {
  withdrawal: {
    id: string;
    amount: number;
    date: string;
    concept: string;
    method: string;
    hasFactura: boolean;
    accountId?: string | null;
    toAccountId?: string | null;
  };
}

export function WithdrawalEditButton({ withdrawal }: WithdrawalEditButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState(String(Math.abs(withdrawal.amount)));
  const [concept, setConcept] = useState(withdrawal.concept);
  const [date, setDate] = useState(withdrawal.date.split("T")[0]);
  const [method, setMethod] = useState(withdrawal.method);
  const [accountId, setAccountId] = useState(withdrawal.accountId || "");
  const [toAccountId, setToAccountId] = useState(withdrawal.toAccountId || "");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);

  useEffect(() => {
    if (open && !accountsLoaded) {
      fetch("/api/accounts")
        .then((r) => r.ok ? r.json() : [])
        .then((data) => { setAccounts(data); setAccountsLoaded(true); })
        .catch(() => setAccountsLoaded(true));
    }
  }, [open, accountsLoaded]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/withdrawals/${withdrawal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount),
          concept,
          date,
          method,
          accountId: accountId || null,
          toAccountId: toAccountId || null,
        }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      toast.success("Retiro actualizado");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Error al actualizar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        title="Editar"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Editar Retiro</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Monto</Label>
                <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div>
                <Label>Fecha</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Concepto</Label>
              <Input value={concept} onChange={(e) => setConcept(e.target.value)} />
            </div>
            <div>
              <Label>Metodo</Label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                <option value="bank">Banco</option>
                <option value="cash">Efectivo</option>
                <option value="provider">Proveedor</option>
              </select>
            </div>
            {accountsLoaded && accounts.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>De (origen)</Label>
                  <Select value={accountId || "NONE"} onValueChange={(v) => setAccountId(v === "NONE" ? "" : (v ?? ""))}>
                    <SelectTrigger><SelectValue placeholder="Cuenta origen..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Sin cuenta</SelectItem>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id} label={a.name}>
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ background: a.color }} />
                            {a.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>A (destino)</Label>
                  <Select value={toAccountId || "NONE"} onValueChange={(v) => setToAccountId(v === "NONE" ? "" : (v ?? ""))}>
                    <SelectTrigger><SelectValue placeholder="Cuenta destino..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Sin cuenta</SelectItem>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id} label={a.name}>
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ background: a.color }} />
                            {a.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
