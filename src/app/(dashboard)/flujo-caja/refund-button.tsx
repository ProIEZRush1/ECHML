"use client";

import { useState } from "react";

export function RefundButton({ orderId }: { orderId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function handleClick() {
    setState("loading");
    try {
      const res = await fetch("/api/orders/process-partial-refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return <span className="text-[11px] font-medium px-2 py-1 rounded-md bg-green-600 text-white">Hecho</span>;
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === "loading"}
      className="text-[11px] font-medium px-2 py-1 rounded-md bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
    >
      {state === "loading" ? "..." : state === "error" ? "Error - Reintentar" : "Ajustar stock"}
    </button>
  );
}
