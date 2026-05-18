"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  TrendingUp,
  Store,
  Settings,
  ChevronDown,
  Boxes,
  Warehouse,
  PackagePlus,
  History,
  Truck,
  PackageCheck,
  BarChart3,
  ArrowDownToLine,
  Receipt,
  FolderOpen,
  Key,
  Sparkles,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { UserNav } from "@/components/layout/user-nav";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const navItems = [
  { title: "Inicio", href: "/dashboard", icon: LayoutDashboard },
  {
    title: "Inventario",
    icon: Package,
    children: [
      { title: "Productos", href: "/productos", icon: Package },
      { title: "Packs", href: "/packs", icon: Boxes },
      { title: "Stock", href: "/stock", icon: Warehouse },
      { title: "Entrada", href: "/stock/entrada", icon: PackagePlus },
      { title: "Historial", href: "/stock/historial", icon: History },
    ],
  },
  {
    title: "Ventas",
    icon: ShoppingCart,
    children: [
      { title: "Ventas", href: "/ventas", icon: ShoppingCart },
      { title: "Pedidos", href: "/pedidos", icon: Truck },
      { title: "Preparar", href: "/preparar", icon: PackageCheck },
      { title: "Publicaciones", href: "/publicaciones", icon: Store },
    ],
  },
  {
    title: "Finanzas",
    icon: TrendingUp,
    children: [
      { title: "Flujo de Caja", href: "/flujo-caja", icon: TrendingUp },
      { title: "Rentabilidad", href: "/rentabilidad", icon: BarChart3 },
      { title: "Gastos", href: "/gastos", icon: Receipt },
      { title: "Retiros", href: "/retiros", icon: ArrowDownToLine },
    ],
  },
  {
    title: "Ajustes",
    icon: Settings,
    children: [
      { title: "Grupos", href: "/configuracion/grupos", icon: FolderOpen },
      { title: "MercadoLibre", href: "/configuracion/mercadolibre", icon: Store },
      { title: "API Keys", href: "/configuracion/api-keys", icon: Key },
      { title: "OpenAI", href: "/configuracion/openai", icon: Sparkles },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const isSectionActive = (children: Array<{ href: string }>) =>
    children.some((c) => pathname.startsWith(c.href));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />}>
              <div className="flex size-7 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-mono text-sm font-bold">
                e
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-mono font-semibold text-sm tracking-tight">echml</span>
                <span className="text-[10.5px] text-sidebar-foreground/50 tracking-wide">
                  Bluemango · MX
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) =>
                "children" in item && item.children ? (
                  <Collapsible
                    key={item.title}
                    defaultOpen={isSectionActive(item.children)}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip={item.title}>
                          <item.icon />
                          <span>{item.title}</span>
                          <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[open]/collapsible:rotate-180" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.children.map((child) => (
                            <SidebarMenuSubItem key={child.href}>
                              <SidebarMenuSubButton
                                isActive={isActive(child.href)}
                                render={<Link href={child.href} />}
                              >
                                <span>{child.title}</span>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                ) : (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      isActive={isActive((item as { href: string }).href)}
                      tooltip={item.title}
                      render={<Link href={(item as { href: string }).href} />}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 py-1">
          <UserNav />
          <div className="pulse-dot ml-auto group-data-[collapsible=icon]:hidden" title="Webhook conectado" />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
