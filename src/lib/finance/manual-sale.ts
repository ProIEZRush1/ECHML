import { prisma } from "@/lib/prisma";
import {
  processManualSale,
  reverseManualSale,
  processManualVariantSale,
  reverseManualVariantSale,
} from "@/lib/stock/engine";

// Qué se vendió en una venta manual: una variante específica, un pack, o texto libre.
export type SaleItem =
  | { kind: "variant"; variantId: string }
  | { kind: "pack"; packId: string }
  | { kind: "free" };

export function resolveItem(input: { productVariantId?: string | null; packId?: string | null }): SaleItem {
  if (input.productVariantId) return { kind: "variant", variantId: input.productVariantId };
  if (input.packId) return { kind: "pack", packId: input.packId };
  return { kind: "free" };
}

// Nombre legible del item (para la descripción de la transacción).
export async function itemDisplayName(item: SaleItem): Promise<string | null> {
  if (item.kind === "variant") {
    const v = await prisma.productVariant.findUnique({
      where: { id: item.variantId },
      select: { variantLabel: true, product: { select: { name: true } } },
    });
    if (!v) return null;
    return `${v.product.name}${v.variantLabel ? ` · ${v.variantLabel}` : ""}`;
  }
  if (item.kind === "pack") {
    const p = await prisma.pack.findUnique({ where: { id: item.packId }, select: { name: true } });
    return p?.name ?? null;
  }
  return null;
}

// Pre-chequeo de disponibilidad (lectura, no autoritativa). Devuelve mensaje de error o null.
export async function precheckStock(item: SaleItem, quantity: number): Promise<string | null> {
  if (item.kind === "variant") {
    const v = await prisma.productVariant.findUnique({
      where: { id: item.variantId },
      select: { stock: true, variantLabel: true, product: { select: { name: true } } },
    });
    if (!v) return "La variante no existe";
    if (v.stock < quantity) {
      return `Stock insuficiente (${v.product.name}${v.variantLabel ? ` ${v.variantLabel}` : ""}): hay ${v.stock}, se necesitan ${quantity}. Apaga "descontar inventario" si vendiste fuera del stock.`;
    }
    return null;
  }
  if (item.kind === "pack") {
    const pack = await prisma.pack.findUnique({
      where: { id: item.packId },
      select: { items: { select: { quantity: true, productVariant: { select: { stock: true, variantLabel: true } } } } },
    });
    if (!pack) return "El pack no existe";
    for (const it of pack.items) {
      const need = it.quantity * quantity;
      if (it.productVariant.stock < need) {
        return `Stock insuficiente${it.productVariant.variantLabel ? ` (${it.productVariant.variantLabel})` : ""}: hay ${it.productVariant.stock}, se necesitan ${need}.`;
      }
    }
    return null;
  }
  return null;
}

export async function applyStock(item: SaleItem, quantity: number, userId: string, reason: string): Promise<void> {
  if (item.kind === "variant") await processManualVariantSale(item.variantId, quantity, userId, reason);
  else if (item.kind === "pack") await processManualSale(item.packId, quantity, userId, reason);
}

export async function reverseStock(item: SaleItem, quantity: number, userId: string, reason: string): Promise<void> {
  if (item.kind === "variant") await reverseManualVariantSale(item.variantId, quantity, userId, reason);
  else if (item.kind === "pack") await reverseManualSale(item.packId, quantity, userId, reason);
}
