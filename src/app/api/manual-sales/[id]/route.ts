import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { verifyAnyAuth } from "@/lib/api-auth";
import { parseLocalDate } from "@/lib/utils";
import { InsufficientStockError } from "@/lib/stock/engine";
import { resolveItem, itemDisplayName, applyStock, reverseStock } from "@/lib/finance/manual-sale";

export const dynamic = "force-dynamic";

const updateManualSaleSchema = z
  .object({
    productVariantId: z.string().nullable().optional(),
    packId: z.string().nullable().optional(),
    concept: z.string().max(300).optional(),
    quantity: z.number().int().positive("La cantidad debe ser mayor a 0").max(100000),
    amount: z.number().positive("El monto debe ser mayor a 0").max(99999999.99, "Monto demasiado grande"),
    date: z.string().min(1, "La fecha es obligatoria"),
    channel: z.string().max(60).optional(),
    notes: z.string().max(500).optional(),
    deductStock: z.boolean().optional().default(true),
  })
  .refine((d) => !!d.productVariantId || !!d.packId || !!(d.concept && d.concept.trim()), {
    message: "Elige un producto/variante, un pack, o escribe un concepto",
  });

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyAnyAuth(request);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.mPTransaction.findUnique({ where: { id } });
  if (!existing || existing.source !== "manual") {
    return NextResponse.json({ error: "Venta manual no encontrada" }, { status: 404 });
  }

  const body = await request.json();
  const result = updateManualSaleSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Datos invalidos", details: result.error.issues }, { status: 400 });
  }
  const { productVariantId, packId, concept, quantity, amount, date, channel, notes, deductStock } = result.data;

  const newItem = resolveItem({ productVariantId, packId });
  const newDeduct = newItem.kind !== "free" && deductStock;
  const itemName = await itemDisplayName(newItem);
  if (newItem.kind !== "free" && itemName === null) {
    return NextResponse.json({ error: "El producto/pack no existe" }, { status: 404 });
  }

  const oldItem = resolveItem({ productVariantId: existing.productVariantId, packId: existing.packId });
  const oldDeducted = existing.type === "manual_sale";

  try {
    // Reconciliacion de stock: revertir el descuento viejo y aplicar el nuevo.
    if (oldDeducted) {
      await reverseStock(oldItem, existing.quantity, session.id, `Editar venta manual #${id} (reverso)`);
    }
    if (newDeduct) {
      try {
        await applyStock(newItem, quantity, session.id, `Editar venta manual #${id}`);
      } catch (e) {
        // No alcanzó el stock para el nuevo: restauramos el descuento viejo y avisamos.
        if (oldDeducted) {
          await applyStock(oldItem, existing.quantity, session.id, `Editar venta manual #${id} (restaurar)`).catch(() => {});
        }
        if (e instanceof InsufficientStockError) {
          return NextResponse.json({ error: e.message }, { status: 409 });
        }
        throw e;
      }
    }

    const descParts = [concept?.trim() || itemName || "Venta manual"];
    if (channel) descParts.push(`(${channel})`);
    if (notes?.trim()) descParts.push(`- ${notes.trim()}`);

    const updated = await prisma.mPTransaction.update({
      where: { id },
      data: {
        type: newDeduct ? "manual_sale" : "manual_sale_nostock",
        amount,
        balanceChange: amount,
        description: descParts.join(" "),
        referenceId: channel || null,
        packId: newItem.kind === "pack" ? newItem.packId : null,
        productVariantId: newItem.kind === "variant" ? newItem.variantId : null,
        quantity,
        dateCreated: parseLocalDate(date),
        paidAt: parseLocalDate(date),
      },
    });

    return NextResponse.json({ id: updated.id, amount: Number(updated.amount), quantity: updated.quantity, deductedStock: newDeduct });
  } catch (error: unknown) {
    console.error("Error al editar venta manual:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyAnyAuth(request);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;

  const sale = await prisma.mPTransaction.findUnique({ where: { id } });
  // Guard: solo se pueden borrar ventas MANUALES desde aqui (nunca tocar filas de ML).
  if (!sale || sale.source !== "manual") {
    return NextResponse.json({ error: "Venta manual no encontrada" }, { status: 404 });
  }

  try {
    // Borramos PRIMERO la fila. Asi un reintento (si la respuesta se pierde) da 404 y
    // no revierte el stock dos veces (lo que inflaria el inventario silenciosamente).
    await prisma.mPTransaction.delete({ where: { id } });

    // Si la venta descontó stock (type='manual_sale'), lo regresamos al inventario.
    if (sale.type === "manual_sale") {
      const item = resolveItem({ productVariantId: sale.productVariantId, packId: sale.packId });
      if (item.kind !== "free") {
        try {
          await reverseStock(item, sale.quantity, session.id, `Reverso venta manual #${sale.id}`);
        } catch (stockErr) {
          console.error(`Venta manual ${id} borrada pero fallo el reverso de stock:`, stockErr);
          return NextResponse.json({ ok: true, stockReverseFailed: true });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error("Error al borrar venta manual:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
