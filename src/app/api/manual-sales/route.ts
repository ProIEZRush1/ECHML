import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { verifyAnyAuth } from "@/lib/api-auth";
import { parseLocalDate } from "@/lib/utils";
import { InsufficientStockError } from "@/lib/stock/engine";
import { resolveItem, itemDisplayName, precheckStock, applyStock } from "@/lib/finance/manual-sale";

export const dynamic = "force-dynamic";

const createManualSaleSchema = z
  .object({
    productVariantId: z.string().optional(), // venta de una variante específica (producto+talla)
    packId: z.string().optional(), // o de un pack del catálogo
    concept: z.string().max(300).optional(), // o descripción libre (sin stock)
    quantity: z.number().int().positive("La cantidad debe ser mayor a 0").max(100000).default(1),
    amount: z.number().positive("El monto debe ser mayor a 0").max(99999999.99, "Monto demasiado grande"),
    date: z.string().min(1, "La fecha es obligatoria"),
    channel: z.string().max(60).optional(), // efectivo / transferencia / whatsapp / etc.
    notes: z.string().max(500).optional(),
    deductStock: z.boolean().optional().default(true),
  })
  .refine((d) => !!d.productVariantId || !!d.packId || !!(d.concept && d.concept.trim()), {
    message: "Elige un producto/variante, un pack, o escribe un concepto",
  });

// Las ventas manuales son filas en MPTransaction con source='manual'. Asi flujo-caja,
// contabilidad y el MCP las cuentan automaticamente (ya leen MPTransaction label='sale')
// y solo la conciliacion del saldo MP las excluye.
export async function GET(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const sales = await prisma.mPTransaction.findMany({
    where: { source: "manual" },
    select: {
      id: true,
      amount: true,
      quantity: true,
      type: true,
      label: true,
      description: true,
      referenceId: true,
      packId: true,
      productVariantId: true,
      dateCreated: true,
      pack: { select: { id: true, sku: true, name: true } },
      productVariant: {
        select: { id: true, variantLabel: true, product: { select: { id: true, name: true, unitCost: true } } },
      },
    },
    orderBy: { dateCreated: "desc" },
  });

  return NextResponse.json(
    sales.map((s) => ({
      ...s,
      amount: Number(s.amount),
      unitCost: s.productVariant ? Number(s.productVariant.product.unitCost) : null,
      deductedStock: s.type === "manual_sale",
      dateCreated: s.dateCreated.toISOString(),
    }))
  );
}

export async function POST(request: NextRequest) {
  const session = await verifyAnyAuth(request);
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = createManualSaleSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Datos invalidos", details: result.error.issues }, { status: 400 });
    }

    const { productVariantId, packId, concept, quantity, amount, date, channel, notes, deductStock } = result.data;
    const item = resolveItem({ productVariantId, packId });
    const willDeduct = item.kind !== "free" && deductStock;

    const itemName = await itemDisplayName(item);
    if (item.kind !== "free" && itemName === null) {
      return NextResponse.json({ error: "El producto/pack no existe" }, { status: 404 });
    }

    // Pre-chequeo de stock → 409 limpio SIN crear la fila (la validacion autoritativa con
    // lock sigue dentro de applyStock para la carrera entre chequeo y descuento).
    if (willDeduct) {
      const err = await precheckStock(item, quantity);
      if (err) return NextResponse.json({ error: err }, { status: 409 });
    }

    const descParts = [concept?.trim() || itemName || "Venta manual"];
    if (channel) descParts.push(`(${channel})`);
    if (notes?.trim()) descParts.push(`- ${notes.trim()}`);

    // mpId es BigInt @unique (ML usa ids positivos reales). Negativo derivado de timestamp×1e6 +
    // aleatorio para no colisionar; si choca (@unique → P2002) reintentamos con otro id.
    const genMpId = () => -(BigInt(Date.now()) * BigInt(1000000) + BigInt(Math.floor(Math.random() * 1000000)));

    let created: { id: string; amount: unknown; quantity: number } | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        created = await prisma.mPTransaction.create({
          data: {
            mpId: genMpId(),
            source: "manual",
            type: willDeduct ? "manual_sale" : "manual_sale_nostock", // marca si descontó stock
            label: "sale", // para que flujo-caja/contabilidad lo cuenten como ingreso
            status: "approved",
            amount,
            balanceChange: amount, // sin comisiones MP en venta manual
            description: descParts.join(" "),
            referenceId: channel || null,
            packId: item.kind === "pack" ? item.packId : null,
            productVariantId: item.kind === "variant" ? item.variantId : null,
            quantity,
            dateCreated: parseLocalDate(date),
            paidAt: parseLocalDate(date),
          },
        });
        break;
      } catch (e: unknown) {
        if (e && typeof e === "object" && "code" in e && e.code === "P2002" && attempt < 3) continue;
        throw e;
      }
    }
    if (!created) {
      return NextResponse.json({ error: "No se pudo registrar la venta, intenta de nuevo" }, { status: 500 });
    }

    if (willDeduct) {
      try {
        await applyStock(item, quantity, session.id, `Venta manual #${created.id}`);
      } catch (e) {
        // Carrera: el stock bajó entre el pre-chequeo y el descuento. Deshacemos la venta.
        await prisma.mPTransaction.delete({ where: { id: created.id } }).catch(() => {});
        if (e instanceof InsufficientStockError) {
          return NextResponse.json({ error: e.message }, { status: 409 });
        }
        throw e;
      }
    }

    return NextResponse.json(
      { id: created.id, amount: Number(created.amount), quantity: created.quantity, deductedStock: willDeduct },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Error al crear venta manual:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
