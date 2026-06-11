import { prisma } from "@/lib/prisma";

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface FlexOrder {
  date: string;
  mlOrderId: string | null;
  groupName: string;
  groupColor: string;
  cost: number;          // gross $115 (what the courier bills)
  paid: boolean;
}
export interface FlexGroup {
  groupId: string | null;
  groupName: string;
  groupColor: string;
  count: number;
  grossCost: number;     // Σ flex_cost (gross, courier bills this)
  bonificacion: number;  // ML credit (NOT a courier discount)
  netCost: number;       // gross − bonificación (real out-of-pocket)
  paid: number;          // paid for this group's flex orders
  balance: number;       // grossCost − paid (owed to courier)
}
export interface FlexData {
  count: number;
  unpaidCount: number;
  grossCost: number;     // matches courier "TOTAL CARGOS" (gross $115 × orders)
  bonificacion: number;  // ML credit, shown separately
  netCost: number;       // gross − bonificación
  paid: number;          // matches courier "TOTAL ABONADO" (what we sent)
  balance: number;       // gross − paid (owed)
  byGroup: FlexGroup[];
  orders: FlexOrder[];
  payments: { date: string; amount: number; concept: string }[];
}

/**
 * Flex (self-service shipping) reconciliation — modeled the COURIER's way:
 * gross $115 per order = "cargos", payments = "abonado", balance = owed.
 * ML's bonificación is a separate credit (not a courier discount), shown apart.
 */
export async function computeFlex(dateFromISO?: string | null): Promise<FlexData> {
  const dateGte = dateFromISO ? { gte: new Date(`${dateFromISO}T00:00:00.000Z`) } : undefined;

  const [groups, flexCosts, flexBonifs, payments] = await Promise.all([
    prisma.productGroup.findMany({
      select: { id: true, name: true, color: true, items: { select: { product: { select: { variants: { select: { packItems: { select: { packId: true } } } } } } } } },
    }),
    prisma.mPTransaction.findMany({
      where: { label: "flex_cost", ...(dateGte ? { dateCreated: dateGte } : {}) },
      select: { mlOrderId: true, packId: true, amount: true, paidAt: true, dateCreated: true },
      orderBy: { dateCreated: "desc" },
    }),
    prisma.mPTransaction.findMany({
      where: { label: "flex_bonificacion", ...(dateGte ? { dateCreated: dateGte } : {}) },
      select: { packId: true, amount: true },
    }),
    prisma.expense.findMany({
      where: { type: "registro", category: "envios", ...(dateGte ? { date: dateGte } : {}) },
      select: { date: true, amount: true, concept: true },
      orderBy: { date: "desc" },
    }),
  ]);

  const packToGroup = new Map<string, string>();
  const groupInfo = new Map<string, { name: string; color: string }>();
  for (const g of groups) {
    groupInfo.set(g.id, { name: g.name, color: g.color });
    for (const it of g.items) for (const v of it.product.variants) for (const pi of v.packItems) {
      if (!packToGroup.has(pi.packId)) packToGroup.set(pi.packId, g.id);
    }
  }

  const gmap = new Map<string | null, FlexGroup>();
  const gacc = (gid: string | null): FlexGroup => {
    let a = gmap.get(gid);
    if (!a) {
      const info = gid ? groupInfo.get(gid) : null;
      a = { groupId: gid, groupName: info?.name ?? "Sin grupo", groupColor: info?.color ?? "#9ca3af", count: 0, grossCost: 0, bonificacion: 0, netCost: 0, paid: 0, balance: 0 };
      gmap.set(gid, a);
    }
    return a;
  };

  let count = 0, grossCost = 0, paidByFlag = 0, unpaidCount = 0;
  const orders: FlexOrder[] = [];
  for (const f of flexCosts) {
    const gid = f.packId ? (packToGroup.get(f.packId) ?? null) : null;
    const cost = Math.abs(Number(f.amount));
    const a = gacc(gid);
    const isPaid = f.paidAt !== null;
    a.count++; a.grossCost += cost; count++; grossCost += cost;
    if (isPaid) { a.paid += cost; paidByFlag += cost; } else unpaidCount++;
    orders.push({ date: f.dateCreated.toISOString(), mlOrderId: f.mlOrderId ? String(f.mlOrderId) : null, groupName: a.groupName, groupColor: a.groupColor, cost, paid: isPaid });
  }

  let bonificacion = 0;
  for (const b of flexBonifs) {
    const gid = b.packId ? (packToGroup.get(b.packId) ?? null) : null;
    const amt = Math.abs(Number(b.amount));
    bonificacion += amt;
    gacc(gid).bonificacion += amt;
  }

  for (const a of gmap.values()) {
    a.netCost = r2(a.grossCost - a.bonificacion);
    a.balance = r2(a.grossCost - a.paid);
    a.grossCost = r2(a.grossCost); a.paid = r2(a.paid); a.bonificacion = r2(a.bonificacion);
  }

  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);

  return {
    count,
    unpaidCount,
    grossCost: r2(grossCost),
    bonificacion: r2(bonificacion),
    netCost: r2(grossCost - bonificacion),
    paid: r2(totalPaid || paidByFlag),
    balance: r2(grossCost - (totalPaid || paidByFlag)),
    byGroup: [...gmap.values()].filter((a) => a.count > 0).sort((x, y) => y.grossCost - x.grossCost),
    orders: orders.slice(0, 300),
    payments: payments.map((p) => ({ date: p.date.toISOString(), amount: Number(p.amount), concept: p.concept })),
  };
}
