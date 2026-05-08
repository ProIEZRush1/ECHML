"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";

export function VentasSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = searchParams.get("q") || "";
  const [value, setValue] = useState(initial);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external changes (e.g. browser back/forward)
  useEffect(() => {
    setValue(searchParams.get("q") || "");
  }, [searchParams]);

  function push(term: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("page"); // reset to page 1 on new search
    if (term.trim()) {
      p.set("q", term.trim());
    } else {
      p.delete("q");
    }
    const qs = p.toString();
    router.push(`/ventas${qs ? `?${qs}` : ""}`);
  }

  function handleChange(val: string) {
    setValue(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => push(val), 500);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      if (timerRef.current) clearTimeout(timerRef.current);
      push(value);
    }
  }

  function clear() {
    setValue("");
    if (timerRef.current) clearTimeout(timerRef.current);
    push("");
  }

  return (
    <div className="relative max-w-sm">
      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Buscar por producto, SKU, orden..."
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className="pl-8 pr-8 h-9"
      />
      {value && (
        <button
          onClick={clear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
