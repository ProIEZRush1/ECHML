import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { verifyAnyAuth } from "@/lib/api-auth";
import { parseLocalDate } from "@/lib/utils";
import { processManualSale, InsufficientStockError } from "@/lib/stock/engine";

export const dynamic = "force-dynamic";

const createManualSaleSchema = z
  .object({
    packId: z.string().optional(),
    concept: z.string().max(300).optional(), // descripcion libre si no hay pack
    quantity: z.number().int().positive("La cantidad debe ser mayor a 0").max(100000).default(1),
    amount: z.number().positive("El monto debe ser mayor a 0").max(99999999.99, "Monto demasiado grande"),
    date: z.string().min(1, "La fecha es obligatoria"),
    channel: z.string().max(60).optional(), // efectivo / transferencia / whatsapp / etc.
    notes: z.string().max(500).optional(),
    deductStock: z.boolean().optional().default(true),
  })
  .refine((d) => !!d.packId || !!(d.concept && d.concept.trim()), {
    message: "Elige un pack del catalogo o escribe un concepto",
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
      dateCreated: true,
      pack: { select: { id: true, sku: true, name: true } },
    },
    orderBy: { dateCreated: "desc" },
  });

  return NextResponse.json(
    sales.map((s) => ({
      ...s,
      amount: Number(s.amount),
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
      return NextResponse.json(
        { error: "Datos invalidos", details: result.error.issues },
        { status: 400 }
      );
    }

    const { packId, concept, quantity, amount, date, channel, notes, deductStock } = result.data;

    // El descuento de stock solo aplica si hay pack ligado y el toggle esta encendido.
    const willDeduct = !!packId && deductStock;

    let packName: string | null = null;
    if (packId) {
      // Si vamos a descontar stock, traemos los componentes para un pre-chequeo de
      // disponibilidad y devolver 409 limpio SIN crear la fila (la validacion autoritativa
      // con lock sigue en processManualSale para la carrera entre chequeo y descuento).
      const pack = await prisma.pack.findUnique({
        where: { id: packId },
        select: {
          name: true,
          items: { select: { quantity: true, productVariant: { select: { stock: true, variantLabel: true } } } },
        },
      });
      if (!pack) {
        return NextResponse.json({ error: "El pack no existe" }, { status: 404 });
      }
      packName = pack.name;
      if (willDeduct) {
        for (const item of pack.items) {
          const needed = item.quantity * quantity;
          if (item.productVariant.stock < needed) {
            return NextResponse.json(
              {
                error: `Stock insuficiente${item.productVariant.variantLabel ? ` (${item.productVariant.variantLabel})` : ""}: se necesitan ${needed} y hay ${item.productVariant.stock}. Apaga "descontar inventario" si vendiste fuera del stock.`,
              },
              { status: 409 }
            );
          }
        }
      }
    }

    const descParts = [concept?.trim() || packName || "Venta manual"];
    if (channel) descParts.push(`(${channel})`);
    if (notes?.trim()) descParts.push(`- ${notes.trim()}`);

    // mpId es BigInt @unique (ML usa ids positivos reales). Usamos un negativo derivado del
    // timestamp (×1e6) + aleatorio de 6 digitos para no colisionar con un pago real ni entre
    // ventas manuales; si aun asi choca (@unique → P2002), reintentamos con otro mpId.
    const genMpId = () =>
      -(BigInt(Date.now()) * BigInt(1000000) + BigInt(Math.floor(Math.random() * 1000000)));

    let created: { id: string; amount: unknown; quantity: number } | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        created = await prisma.mPTransaction.create({
          data: {
            mpId: genMpId(),
            source: "manual",
            // type marca si se descontó stock (para revertirlo al borrar)
            type: willDeduct ? "manual_sale" : "manual_sale_nostock",
            label: "sale", // para que flujo-caja/contabilidad lo cuenten como ingreso
            status: "approved",
            amount,
            balanceChange: amount, // sin comisiones MP en venta manual
            description: descParts.join(" "),
            referenceId: channel || null,
            packId: packId || null,
            quantity,
            dateCreated: parseLocalDate(date),
            paidAt: parseLocalDate(date),
          },
        });
        break;
      } catch (e: unknown) {
        // P2002 = mpId duplicado (carrera improbable): reintenta con otro id.
        if (e && typeof e === "object" && "code" in e && e.code === "P2002" && attempt < 3) continue;
        throw e;
      }
    }
    if (!created) {
      return NextResponse.json({ error: "No se pudo registrar la venta, intenta de nuevo" }, { status: 500 });
    }

    if (willDeduct && packId) {
      try {
        await processManualSale(packId, quantity, session.id, `Venta manual #${created.id}`);
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
