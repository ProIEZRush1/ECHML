"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface FlexCostEditorProps {
  transactionId: string;
  amount: number;
  isCredit: boolean;
}

export function FlexCostEditor({ transactionId, amount, isCredit }: FlexCostEditorProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(Math.abs(amount)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  function handleOpen() {
    setValue(String(Math.abs(amount)));
    setError(null);
    setEditing(true);
  }

  function handleCancel() {
    setEditing(false);
    setError(null);
  }

  async function handleSave() {
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed <= 0) {
      setError("Monto invalido");
      return;
    }

    if (parsed === Math.abs(amount)) {
      setEditing(false);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/mp/transactions/${transactionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsed }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Error al guardar");
        return;
      }

      setEditing(false);
      router.refresh();
    } catch {
      setError("Error de conexion");
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 justify-end">
        <span className="text-muted-foreground text-[11px]">$</span>
        <input
          ref={inputRef}
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={saving}
          className="w-[80px] h-[24px] rounded border border-border bg-background px-1.5 text-[12px] num text-right focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : (
          <>
            <button
              onClick={handleSave}
              className="p-0.5 rounded hover:bg-muted text-green-600 dark:text-green-400"
              title="Guardar"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleCancel}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground"
              title="Cancelar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        )}
        {error && <span className="text-[10px] text-red-500 ml-1">{error}</span>}
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 group">
      <span className={isCredit ? "margin-good" : "margin-bad"}>
        {isCredit ? "+" : "-"}{formatCurrency(Math.abs(amount))}
      </span>
      <button
        onClick={handleOpen}
        className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity"
        title="Editar monto Flex"
      >
        <Pencil className="h-3 w-3 text-muted-foreground" />
      </button>
    </span>
  );
}
