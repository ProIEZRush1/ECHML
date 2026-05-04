"use client";

import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const breadcrumbMap: Record<string, { section?: string; page: string }> = {
  "/dashboard": { page: "Panel" },
  "/productos": { page: "Productos" },
  "/packs": { page: "Packs" },
  "/publicaciones": { page: "Publicaciones ML" },
  "/stock": { section: "Inventario", page: "Vista General" },
  "/stock/entrada": { section: "Inventario", page: "Entrada de Stock" },
  "/stock/historial": { section: "Inventario", page: "Historial" },
  "/ventas": { page: "Ventas" },
  "/configuracion/mercadolibre": {
    section: "Configuracion",
    page: "MercadoLibre",
  },
};

export function Header() {
  const pathname = usePathname();

  const crumb = breadcrumbMap[pathname] ?? { page: "Pagina" };

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4!" />
      <div className="flex flex-1 items-center justify-between">
        <nav className="flex items-center gap-1.5 text-sm">
          {crumb.section && (
            <>
              <span className="text-muted-foreground">{crumb.section}</span>
              <span className="text-muted-foreground/60">/</span>
            </>
          )}
          <span className="font-medium text-foreground">{crumb.page}</span>
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
