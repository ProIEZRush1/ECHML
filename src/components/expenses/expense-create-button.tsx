import Link from "next/link";
import { Plus } from "lucide-react";

export function ExpenseCreateButton() {
  return (
    <Link
      href="/gastos/nuevo"
      className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium h-9 px-4 py-2 bg-primary text-primary-foreground shadow-xs hover:bg-primary/90"
    >
      <Plus className="h-4 w-4" />
      Nuevo Gasto
    </Link>
  );
}
