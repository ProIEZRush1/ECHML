import { Loader2 } from "lucide-react";

export default function PrepararLoading() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">Preparar Envios</h1>
          <p className="text-[13px] text-muted-foreground">Ordenes pendientes de empaque y envio</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-[9px] border border-border bg-card px-3 py-2.5">
            <div className="h-3 w-16 bg-muted rounded animate-pulse" />
            <div className="h-6 w-8 bg-muted rounded animate-pulse mt-2" />
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Cargando ordenes y fechas de envio...</p>
      </div>
    </div>
  );
}
