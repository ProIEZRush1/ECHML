"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Account {
  id: string;
  name: string;
  color: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
}

export function TransferFormDialog({ open, onOpenChange, accounts }: Props) {
  const router = useRouter();
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [concept, setConcept] = useState("");
  const [hasFactura, setHasFactura] = useState(false);
  const [loading, setLoading] = useState(false);

  const numAmount = parseFloat(amount) || 0;
  const netAmount = hasFactura ? numAmount * 0.97 : numAmount;
  const facturaCost = hasFactura ? numAmount * 0.03 : 0;

  async function handleSubmit() {
    if (!fromId || !toId || !amount || !concept.trim()) {
      toast.error("Completa todos los campos");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/account-transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromAccountId: fromId,
          toAccountId: toId,
          amount: parseFloat(amount),
          date,
          concept: concept.trim(),
          hasFactura,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Error al crear transferencia");
        return;
      }
      toast.success("Transferencia registrada");
      setFromId(""); setToId(""); setAmount(""); setConcept("");
      onOpenChange(false);
      router.refresh();
    } catch { toast.error("Error de conexion"); } finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pago entre Cuentas</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>De</Label>
              <Select value={fromId} onValueChange={(v) => setFromId(v || "")}>
                <SelectTrigger><SelectValue placeholder="Cuenta origen..." /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id} label={a.name}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>A</Label>
              <Select value={toId} onValueChange={(v) => setToId(v || "")}>
                <SelectTrigger><SelectValue placeholder="Cuenta destino..." /></SelectTrigger>
                <SelectContent>
                  {accounts.filter((a) => a.id !== fromId).map((a) => (
                    <SelectItem key={a.id} value={a.id} label={a.name}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Monto</Label>
              <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Concepto</Label>
            <Input value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Ej: Pago proveedor" />
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer py-2 px-3 rounded-md border border-input hover:bg-muted/50">
            <input
              type="checkbox"
              checked={hasFactura}
              onChange={(e) => setHasFactura(e.target.checked)}
              className="rounded border-input h-4 w-4"
            />
            <div className="flex-1">
              <span className="text-sm font-medium">Factura (3%)</span>
              {hasFactura && numAmount > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  Sale {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(numAmount)} → Llega {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(netAmount)} (factura -{new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(facturaCost)})
                </p>
              )}
            </div>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
            Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
