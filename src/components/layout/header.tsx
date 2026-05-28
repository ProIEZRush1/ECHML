"use client";

import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { RefreshCw, Bell, Search } from "lucide-react";

const breadcrumbMap: Record<string, { section?: string; page: string }> = {
  "/dashboard": { section: "Principal", page: "Panel" },
  "/productos": { section: "Principal", page: "Productos" },
  "/packs": { section: "Principal", page: "Packs" },
  "/publicaciones": { section: "Comercio", page: "Publicaciones" },
  "/stock": { section: "Inventario", page: "Vista General" },
  "/stock/entrada": { section: "Inventario", page: "Entrada de Stock" },
  "/stock/historial": { section: "Inventario", page: "Historial" },
  "/ventas": { section: "Comercio", page: "Ventas" },
  "/flujo-caja": { section: "Finanzas", page: "Flujo de Caja" },
  "/rentabilidad": { section: "Finanzas", page: "Rentabilidad" },
  "/retiros": { section: "Finanzas", page: "Retiros" },
  "/gastos": { section: "Finanzas", page: "Gastos" },
  "/configuracion/mercadolibre": { section: "Sistema", page: "Config MercadoLibre" },
  "/configuracion/openai": { section: "Sistema", page: "OpenAI" },
  "/configuracion/api-keys": { section: "Sistema", page: "API Keys" },
  "/configuracion/grupos": { section: "Sistema", page: "Grupos" },
};

export function Header() {
  const pathname = usePathname();

  const matchedPath = Object.keys(breadcrumbMap)
    .sort((a, b) => b.length - a.length)
    .find((key) => pathname.startsWith(key));

  const crumb = matchedPath ? breadcrumbMap[matchedPath] : { page: "Pagina" };

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/50 bg-background/80 px-4 sm:px-7 backdrop-blur-xl supports-[backdrop-filter]:bg-background/50 sticky top-0 z-10">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-4!" />

      <nav className="flex items-center gap-2 text-xs">
        {crumb.section && (
          <>
            <span className="text-muted-foreground">{crumb.section}</span>
            <span className="text-muted-foreground/40">/</span>
          </>
        )}
        <span className="font-semibold text-foreground">{crumb.page}</span>
      </nav>

      <div className="hidden sm:flex items-center gap-1.5 text-[11.5px] text-muted-foreground ml-4">
        <span className="pulse-dot" />
        <span>MercadoLibre conectado</span>
      </div>

      <div className="flex-1" />

      <div className="hidden md:flex items-center gap-2 px-2.5 py-1.5 bg-muted border border-border rounded-lg text-xs text-muted-foreground min-w-[240px]">
        <Search className="size-3.5" />
        <span className="flex-1">Buscar productos, packs...</span>
        <kbd className="font-mono text-[10px] bg-card border border-border rounded px-1.5 py-0.5">⌘K</kbd>
      </div>

      <button className="size-7 flex items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted" title="Sincronizar">
        <RefreshCw className="size-3.5" />
      </button>
      <button className="size-7 flex items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted" title="Notificaciones">
        <Bell className="size-3.5" />
      </button>
      <ThemeToggle />
    </header>
  );
}
