import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(num);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Mexico_City",
  }).format(d);
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Mexico_City",
  }).format(d);
}

export const COLOR_MAP = {
  AZUL: { label: "Azul", hex: "#3b82f6", bg: "bg-blue-500", text: "text-blue-600" },
  VERDE: { label: "Verde", hex: "#22c55e", bg: "bg-green-500", text: "text-green-600" },
  ROSA: { label: "Rosa", hex: "#ec4899", bg: "bg-pink-500", text: "text-pink-600" },
  MORADO: { label: "Morado", hex: "#a855f7", bg: "bg-purple-500", text: "text-purple-600" },
} as const;

export type ColorKey = keyof typeof COLOR_MAP;

export function getVariantDisplay(variant: { color?: string | null; variantLabel?: string | null }): { label: string; hex: string; bg: string; text: string } {
  if (variant.color && variant.color in COLOR_MAP) {
    return COLOR_MAP[variant.color as ColorKey];
  }
  if (variant.variantLabel) {
    const labelLower = variant.variantLabel.toLowerCase();
    const labelColorMap: Record<string, ColorKey> = { azul: "AZUL", verde: "VERDE", rosa: "ROSA", morado: "MORADO", lila: "MORADO", blue: "AZUL", green: "VERDE", pink: "ROSA", purple: "MORADO" };
    if (labelLower in labelColorMap) {
      const mapped = COLOR_MAP[labelColorMap[labelLower]];
      return { ...mapped, label: variant.variantLabel };
    }
    return { label: variant.variantLabel, hex: "#6b7280", bg: "bg-gray-500", text: "text-gray-600" };
  }
  return { label: "Sin variante", hex: "#9ca3af", bg: "bg-gray-400", text: "text-gray-500" };
}

export function getStockStatus(stock: number): "healthy" | "low" | "out" {
  if (stock <= 0) return "out";
  if (stock <= 10) return "low";
  return "healthy";
}

export function getStockColor(stock: number): string {
  const status = getStockStatus(stock);
  switch (status) {
    case "healthy":
      return "text-green-600 dark:text-green-400";
    case "low":
      return "text-amber-600 dark:text-amber-400";
    case "out":
      return "text-red-600 dark:text-red-400";
  }
}
