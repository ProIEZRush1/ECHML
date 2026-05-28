export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Activity,
  ExternalLink,
  Package,
} from "lucide-react";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { MPSyncButton } from "./mp-sync-button";
import { FlexCostEditor } from "./flex-cost-editor";
import { CashflowFilters } from "./cashflow-filters";
import { AdsCostCard } from "./ads-cost-card";
import { FinancialCardsWrapper } from "./financial-cards-wrapper";
import Link from "next/link";
import Image from "next/image";

const COLOR_DOT: Record<string, string> = {
  AZUL: "bg-blue-500",
  VERDE: "bg-green-500",
  ROSA: "bg-pink-400",
  MORADO: "bg-purple-500",
};

const COLOR_LABEL: Record<string, string> = {
  AZUL: "Azul",
  VERDE: "Verde",
  ROSA: "Rosa",
  MORADO: "Morado",
};

const LABEL_COLOR_DOT: Record<string, string> = {
  "Blanco": "bg-white border border-gray-300",
  "Negro": "bg-black",
  "Gris": "bg-gray-400",
  "Multicolor": "bg-gradient-to-r from-blue-500 via-green-500 to-pink-500",
  "Azul": "bg-blue-500",
  "Verde": "bg-green-500",
  "Rosa": "bg-pink-400",
  "Morado": "bg-purple-500",
  "Blanco / S": "bg-white border border-gray-300",
  "Blanco / M": "bg-white border border-gray-300",
  "Blanco / L": "bg-white border border-gray-300",
  "Negro / S": "bg-black",
  "Negro / M": "bg-black",
  "Negro / L": "bg-black",
  "Gris / S": "bg-gray-400",
  "Gris / M": "bg-gray-400",
  "Gris / L": "bg-gray-400",
};

interface PackBalance {
  id: string;
  sku: string;
  name: string;
  imageUrl: string | null;
  income: number;
  fees: number;
  shipping: number;
  taxes: number;
  productCost: number;
  flexCost: number;
  gastos: number;
  salesCount: number;
  netIncome: number;
  transactionCount: number;
  colors: { color: string | null; label: string | null }[];
}

type MovimientoRow =
  | { kind: "tx"; id: string; date: Date; label: string; description: string | null; amount: number; balanceChange: number; type: string; mlOrderId: string | null; mlPackId: string | null; pack: { id: string; sku: string; name: string; imageUrl: string | null } | null }
  | { kind: "expense"; id: string; date: Date; concept: string; amount: number; category: string; packIds: string[] };

export default async function FlujoCajaPage({
  searchParams,
}: {
  searchParams: Promise<{
    packId?: string;
    packIds?: string;
    productId?: string;
    productIds?: string;
    dateFrom?: string;
    dateTo?: string;
    label?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page || "1", 10));
  const pageSize = 50;

  // Sync MP transactions + order statuses server-side BEFORE querying
  // This ensures the page always shows the latest data, consistently
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    await Promise.all([
      fetch(`${baseUrl}/api/mp/sync`, { method: "POST", cache: "no-store" }).catch(() => null),
      fetch(`${baseUrl}/api/orders/sync-status`, { method: "POST", cache: "no-store" }).catch(() => null),
    ]);
  } catch { /* sync errors shouldn't block the page */ }

  // Query unprocessed partial refunds for display
  const partialRefunds = await prisma.mLOrder.findMany({
    where: { partialRefundQty: { gt: 0 }, partialRefundProcessed: false },
    select: { id: true, mlOrderId: true, mlItemId: true, quantity: true, partialRefundQty: true, unitPrice: true, dateCreated: true },
    orderBy: { dateCreated: "desc" },
    take: 20,
  });

  // Parse multiple pack IDs (support both legacy packId and new packIds)
  const packIdList: string[] = [];
  if (params.packIds) {
    packIdList.push(...params.packIds.split(",").filter(Boolean));
  } else if (params.packId) {
    packIdList.push(params.packId);
  }

  // If productId(s) set, find all packs linked to those products' variants
  const productIdList: string[] = [];
  if (params.productIds) {
    productIdList.push(...params.productIds.split(",").filter(Boolean));
  } else if (params.productId) {
    productIdList.push(params.productId);
  }

  let productFilteredPackIds: string[] | null = null;
  let filteredProductName: string | null = null;
  let filteredGroupIds: string[] = [];
  if (productIdList.length > 0) {
    const [packItems, product, groupItems] = await Promise.all([
      prisma.packItem.findMany({
        where: { productVariant: { productId: { in: productIdList } } },
        select: { packId: true },
      }),
      prisma.product.findFirst({
        where: { id: { in: productIdList } },
        select: { name: true, brand: true },
      }),
      prisma.productGroupItem.findMany({
        where: { productId: { in: productIdList } },
        select: { productGroupId: true },
      }),
    ]);
    productFilteredPackIds = [...new Set(packItems.map((pi) => pi.packId))];
    filteredGroupIds = [...new Set(groupItems.map((g) => g.productGroupId))];
    filteredProductName = product
      ? `${product.name}${product.brand ? ` (${product.brand})` : ""}`
      : null;
  }

  // Build filter conditions for MPTransactions
  const where: {
    packId?: string | { in: string[] };
    dateCreated?: { gte?: Date; lte?: Date };
    label?: string;
  } = {};

  // Combine pack filters: explicit packIds + product-derived packIds
  const effectivePackIds = productFilteredPackIds
    ? packIdList.length > 0
      ? packIdList.filter((id) => productFilteredPackIds!.includes(id))
      : productFilteredPackIds
    : packIdList;

  if (effectivePackIds.length === 1) {
    where.packId = effectivePackIds[0];
  } else if (effectivePackIds.length > 1) {
    where.packId = { in: effectivePackIds };
  } else if (productFilteredPackIds && productFilteredPackIds.length === 0) {
    // Product has no linked packs, force empty result
    where.packId = { in: [] };
  }

  // Default to last 30 days if no date filter set
  const defaultDateFrom = new Date();
  defaultDateFrom.setDate(defaultDateFrom.getDate() - 30);
  const effectiveDateFrom = params.dateFrom || defaultDateFrom.toISOString().split("T")[0];

  where.dateCreated = {};
  where.dateCreated.gte = new Date(`${effectiveDateFrom}T00:00:00.000Z`);
  if (params.dateTo) {
    where.dateCreated.lte = new Date(`${params.dateTo}T23:59:59.999Z`);
  }

  if (params.label) {
    where.label = params.label;
  }

  // Fetch ALL filtered transactions once — reused for KPIs, table, and pack balances
  const [allTransactions, allPacks, packsWithCosts, filteredExpenses, withdrawals] = await Promise.all([
    prisma.mPTransaction.findMany({
      where,
      orderBy: { dateCreated: "desc" },
      include: {
        pack: { select: { id: true, sku: true, name: true, imageUrl: true } },
      },
    }),
    prisma.pack.findMany({
      select: {
        id: true,
        sku: true,
        name: true,
        imageUrl: true,
        items: {
          select: {
            quantity: true,
            productVariant: {
              select: { color: true, variantLabel: true },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.pack.findMany({
      select: {
        id: true,
        items: {
          select: {
            quantity: true,
            productVariant: { select: { product: { select: { unitCost: true } } } },
          },
        },
        mlListings: {
          select: { mlItemId: true },
          take: 1,
        },
      },
    }),
    prisma.expense.findMany({
      where: {
        type: { in: ["gasto", "compra"] },
        date: {
          gte: new Date(`${effectiveDateFrom}T00:00:00.000Z`),
          ...(params.dateTo ? { lte: new Date(`${params.dateTo}T23:59:59.999Z`) } : {}),
        },
      },
      select: { id: true, amount: true, date: true, concept: true, category: true, type: true, transactionIds: true, packId: true, productId: true, productGroupId: true, accountId: true },
    }),
    prisma.withdrawal.findMany({
      where: {
        date: {
          gte: new Date(`${effectiveDateFrom}T00:00:00.000Z`),
          ...(params.dateTo ? { lte: new Date(`${params.dateTo}T23:59:59.999Z`) } : {}),
        },
        ...(effectivePackIds.length > 0
          ? {
              OR: [
                { allocations: { some: { packId: { in: effectivePackIds } } } },
                ...(filteredGroupIds.length > 0
                  ? [{ productGroupId: { in: filteredGroupIds } }]
                  : []),
              ],
            }
          : filteredGroupIds.length > 0
            ? { productGroupId: { in: filteredGroupIds } }
            : {}),
      },
      select: { amount: true, hasFactura: true, productGroupId: true, allocations: { select: { packId: true } } },
    }),
  ]);

  const [accounts, flexPayments, facturas, activeGroups] = await Promise.all([
    prisma.account.findMany({ select: { id: true, name: true, color: true }, orderBy: { name: "asc" } }),
    prisma.expense.aggregate({
      where: { type: "registro", category: "envios" },
      _sum: { amount: true },
    }),
    prisma.factura.findMany({
      where: {
        status: { not: "cancelada" },
        ...(filteredGroupIds.length > 0
          ? { productGroupId: { in: filteredGroupIds } }
          : {}),
        ...(params.dateFrom || params.dateTo ? {
          fechaEmision: {
            ...(params.dateFrom ? { gte: new Date(`${params.dateFrom}T00:00:00.000Z`) } : {}),
            ...(params.dateTo ? { lte: new Date(`${params.dateTo}T23:59:59.999Z`) } : {}),
          },
        } : {}),
      },
      select: { total: true, productGroupId: true },
    }),
    filteredGroupIds.length > 0
      ? prisma.productGroup.findMany({
          where: { id: { in: filteredGroupIds } },
          select: { id: true, facturaSobreMercancia: true },
        })
      : Promise.resolve([]),
  ]);
  const totalFlexPaid = Number(flexPayments._sum?.amount || 0);
  const totalFacturasEmitidas = facturas.reduce((s, f) => s + Number(f.total), 0);
  const hasFacturaSobreMercancia = activeGroups.some((g) => g.facturaSobreMercancia);

  // Fetch ads cost server-side using the DB snapshot (or ML API fallback)
  let serverAdsCost = 0;
  try {
    const adsConfig = await prisma.systemConfig.findUnique({ where: { key: "ads_snapshot" } });
    if (adsConfig) {
      const snapshot = JSON.parse(adsConfig.value);
      const adsItems: { item_id: string; metrics: { cost: number } }[] = snapshot.items || [];

      // Build allowed ML item IDs for product filter
      let adsAllowedIds: Set<string> | null = null;
      if (effectivePackIds.length > 0) {
        const adsListings = await prisma.mLListing.findMany({
          where: { packId: { in: effectivePackIds } },
          select: { mlItemId: true },
        });
        adsAllowedIds = new Set(adsListings.map((l) => l.mlItemId));
      }

      const filteredAds = adsAllowedIds ? adsItems.filter((i) => adsAllowedIds!.has(i.item_id)) : adsItems;
      serverAdsCost = Math.round(filteredAds.reduce((s, i) => s + (i.metrics?.cost || 0), 0) * 100) / 100;
    }
  } catch { /* ignore ads errors — will show 0 */ }

  // Derive paginated table + count from the single fetch
  const totalCount = allTransactions.length;
  const totalPages = Math.ceil(totalCount / pageSize);
  const mpTransactions = allTransactions.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Resolve expense transactionIds -> packIds for filtering and distribution
  const allTxIdsFromExpenses = new Set<string>();
  for (const exp of filteredExpenses) {
    if (exp.transactionIds) {
      exp.transactionIds.split(",").filter(Boolean).forEach((id) => allTxIdsFromExpenses.add(id));
    }
  }

  const txToPackMap = new Map<string, string>();
  if (allTxIdsFromExpenses.size > 0) {
    const linkedTxs = await prisma.mPTransaction.findMany({
      where: { id: { in: [...allTxIdsFromExpenses] } },
      select: { id: true, packId: true },
    });
    for (const ltx of linkedTxs) {
      if (ltx.packId) txToPackMap.set(ltx.id, ltx.packId);
    }
  }

  // Filter expenses: include if packId/productId matches OR transactionIds link to matching packs
  const hasPackFilter = effectivePackIds.length > 0;
  const hasProductFilter = productIdList.length > 0;
  const effectivePackSet = new Set(effectivePackIds);

  type ExpenseWithDetails = typeof filteredExpenses[number] & { resolvedPackIds: string[] };
  const relevantExpenses: ExpenseWithDetails[] = [];

  for (const exp of filteredExpenses) {
    const resolvedPackIds: string[] = [];
    if (exp.transactionIds) {
      for (const txId of exp.transactionIds.split(",").filter(Boolean)) {
        const pId = txToPackMap.get(txId);
        if (pId) resolvedPackIds.push(pId);
      }
    }
    const uniquePacks = [...new Set(resolvedPackIds)];

    if (!hasPackFilter && !hasProductFilter) {
      relevantExpenses.push({ ...exp, resolvedPackIds: uniquePacks });
    } else {
      const matchesPack = exp.packId && effectivePackSet.has(exp.packId);
      const matchesProduct = exp.productId && productIdList.includes(exp.productId);
      const matchesTxPacks = uniquePacks.some((pId) => effectivePackSet.has(pId));
      const matchesGroup = exp.productGroupId && filteredGroupIds.length > 0 && filteredGroupIds.includes(exp.productGroupId);
      if (matchesPack || matchesProduct || matchesTxPacks || matchesGroup) {
        relevantExpenses.push({ ...exp, resolvedPackIds: uniquePacks });
      }
    }
  }

  // Find returned/cancelled order IDs to exclude from KPIs (filtered by date + pack)
  const returnedWhere: Record<string, unknown> = {
    shippingStatus: { in: ["RETURNED", "NOT_DELIVERED", "CANCELLED"] },
    dateCreated: {
      gte: new Date(`${effectiveDateFrom}T00:00:00.000Z`),
      ...(params.dateTo ? { lte: new Date(`${params.dateTo}T23:59:59.999Z`) } : {}),
    },
  };
  if (effectivePackIds.length > 0) {
    const returnMlItemIds = await prisma.mLListing.findMany({
      where: { packId: { in: effectivePackIds } },
      select: { mlItemId: true },
    });
    returnedWhere.mlItemId = { in: returnMlItemIds.map((l) => l.mlItemId) };
  }
  const returnedOrders = await prisma.mLOrder.findMany({
    where: returnedWhere,
    select: { mlOrderId: true, mlItemId: true, quantity: true, logisticType: true, shippingStatus: true, returnShipCost: true },
  });
  const returnedOrderIds = new Set(returnedOrders.map((o) => o.mlOrderId));


  // Use the same data for KPIs (no separate query = no inconsistency)
  const allFilteredTransactions = allTransactions;

  // Build pack cost map: packId -> cost per unit sold
  const packCostMap = new Map<string, number>();
  for (const pack of packsWithCosts) {
    const cost = pack.items.reduce(
      (sum, item) => sum + item.quantity * Number(item.productVariant.product.unitCost),
      0
    );
    if (cost > 0) packCostMap.set(pack.id, cost);
  }

  let totalIncome = 0;
  let totalFees = 0;
  let totalShipping = 0;
  let totalProductCost = 0;
  let totalFlexCost = 0;
  let totalFlexBonificacion = 0;
  let totalUnits = 0;
  const salesPerPack = new Map<string, number>();

  let totalReturns = 0;
  const filteredReturnCount = returnedOrders.length;
  const filteredReturnFromFull = returnedOrders.filter((o) => o.logisticType === "fulfillment").length;
  for (const tx of allFilteredTransactions) {
    if (tx.mlOrderId && returnedOrderIds.has(tx.mlOrderId)) {
      const amt = Number(tx.amount);
      if (tx.label === "sale") {
        totalReturns += amt;
      }
      continue;
    }
    const amount = Number(tx.amount);
    if (tx.label === "sale") {
      totalIncome += amount;
      totalUnits += tx.quantity;
      if (tx.packId) {
        salesPerPack.set(tx.packId, (salesPerPack.get(tx.packId) || 0) + tx.quantity);
      }
    } else if (tx.label === "fee" || tx.label === "commission") {
      totalFees += Math.abs(amount);
    } else if (tx.label === "shipping") {
      totalShipping += Math.abs(amount);
    } else if (tx.label === "flex_cost") {
      totalFlexCost += Math.abs(amount);
    } else if (tx.label === "flex_bonificacion") {
      totalFlexBonificacion += amount;
    }
  }

  for (const [packId, count] of salesPerPack) {
    const costPerUnit = packCostMap.get(packId) || 0;
    totalProductCost += costPerUnit * count;
  }

  // Calculate product cost for returned orders using MPTransaction packId
  let returnedProductCost = 0;
  for (const ro of returnedOrders) {
    const roTx = allFilteredTransactions.find((t) => t.mlOrderId === ro.mlOrderId && t.label === "sale");
    if (roTx?.packId) {
      const costPerUnit = packCostMap.get(roTx.packId) || 0;
      returnedProductCost += costPerUnit * ro.quantity;
    }
  }

  // Tax calculation (Mexico RESICO regime)
  const totalBase = totalIncome / 1.16;
  const totalRetencionIVA = totalBase * 0.08;
  const totalRetencionISR = totalBase * 0.025;
  const totalImpuestos = totalRetencionIVA + totalRetencionISR;

  const totalGastos = relevantExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalGastosOp = relevantExpenses.filter((e) => e.type === "gasto").reduce((sum, e) => sum + Number(e.amount), 0);
  const totalCompras = relevantExpenses.filter((e) => e.type === "compra").reduce((sum, e) => sum + Number(e.amount), 0);

  // Gastos per account for the "what to pay" breakdown
  const gastosByAccount: Record<string, number> = {};
  for (const exp of relevantExpenses) {
    const accId = exp.accountId || "__none__";
    gastosByAccount[accId] = (gastosByAccount[accId] || 0) + Number(exp.amount);
  }

  const totalReturnShipCost = returnedOrders
    .reduce((s, o) => s + Number(o.returnShipCost || 0), 0);
  const flexTxs = allFilteredTransactions.filter((t) => t.label === "flex_cost");
  const flexCount = flexTxs.length;
  const flexPaidCount = flexTxs.filter((t) => t.paidAt !== null).length;
  const flexUnpaidCost = flexTxs.filter((t) => t.paidAt === null).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const totalFlexNet = totalFlexCost - totalFlexBonificacion;
  const totalNet = totalIncome - totalFees - totalShipping - totalImpuestos - totalProductCost - totalGastosOp - totalFlexNet - totalReturnShipCost;
  const totalWithdrawn = withdrawals.reduce((s, w) => s + Number(w.amount), 0);
  const totalFacturaCost = hasFacturaSobreMercancia
    ? Math.max(0, (totalIncome - totalFees - totalShipping - totalImpuestos - totalGastosOp - totalFlexNet - totalReturnShipCost - totalFacturasEmitidas)) * 0.03
    : withdrawals.filter((w) => w.hasFactura).reduce((s, w) => s + Number(w.amount) * 0.03, 0);
  const availableToWithdraw = totalIncome - totalFees - totalShipping - totalImpuestos - totalGastos - totalFlexNet - totalWithdrawn;

  // Calculate balance per pack -- apply same pack filter as KPI cards
  const packWhere: {
    packId?: string | { in: string[] };
    dateCreated?: { gte?: Date; lte?: Date };
    label?: string;
  } = {};

  // Apply the same pack filter to the Balance por Pack section
  if (effectivePackIds.length === 1) {
    packWhere.packId = effectivePackIds[0];
  } else if (effectivePackIds.length > 1) {
    packWhere.packId = { in: effectivePackIds };
  } else if (productFilteredPackIds && productFilteredPackIds.length === 0) {
    packWhere.packId = { in: [] };
  }

  packWhere.dateCreated = {};
  packWhere.dateCreated.gte = new Date(`${effectiveDateFrom}T00:00:00.000Z`);
  if (params.dateTo) {
    packWhere.dateCreated.lte = new Date(`${params.dateTo}T23:59:59.999Z`);
  }

  // Reuse allTransactions for pack balances (same data, no separate query)
  const packTransactions = allTransactions;

  // Aggregate by pack
  const packMap = new Map<
    string,
    { income: number; fees: number; shipping: number; flexCost: number; gastos: number; salesCount: number; count: number }
  >();

  for (const tx of packTransactions) {
    if (!tx.packId) continue;
    const existing = packMap.get(tx.packId) || { income: 0, fees: 0, shipping: 0, flexCost: 0, gastos: 0, salesCount: 0, count: 0 };
    const amount = Number(tx.amount);

    if (tx.label === "sale") {
      existing.income += amount;
      existing.salesCount += tx.quantity;
    } else if (tx.label === "fee" || tx.label === "commission") {
      existing.fees += Math.abs(amount);
    } else if (tx.label === "shipping") {
      existing.shipping += Math.abs(amount);
    } else if (tx.label === "flex_cost") {
      existing.flexCost += Math.abs(amount);
    } else if (tx.label === "flex_bonificacion") {
      existing.flexCost -= amount;
    }
    existing.count += 1;
    packMap.set(tx.packId, existing);
  }

  // Distribute expenses to packs via transactionIds
  for (const exp of relevantExpenses) {
    const amt = Number(exp.amount);
    if (exp.resolvedPackIds.length > 0) {
      const uniquePacks = [...new Set(exp.resolvedPackIds)];
      const share = amt / uniquePacks.length;
      for (const pId of uniquePacks) {
        const existing = packMap.get(pId) || { income: 0, fees: 0, shipping: 0, flexCost: 0, gastos: 0, salesCount: 0, count: 0 };
        existing.gastos += share;
        packMap.set(pId, existing);
      }
    } else if (exp.packId) {
      const existing = packMap.get(exp.packId) || { income: 0, fees: 0, shipping: 0, flexCost: 0, gastos: 0, salesCount: 0, count: 0 };
      existing.gastos += amt;
      packMap.set(exp.packId, existing);
    }
  }

  // Build pack balances with taxes and product cost
  const packBalances: PackBalance[] = [];
  for (const pack of allPacks) {
    if (effectivePackIds.length > 0 && !effectivePackIds.includes(pack.id)) continue;
    const data = packMap.get(pack.id);
    if (!data) continue;

    const packBase = data.income / 1.16;
    const packTaxes = packBase * 0.08 + packBase * 0.025;
    const packProductCost = (packCostMap.get(pack.id) || 0) * data.salesCount;

    const packItems = (pack as typeof allPacks[number]).items || [];
    const colors = packItems.map((item) => ({
      color: item.productVariant.color,
      label: item.productVariant.variantLabel,
    }));

    packBalances.push({
      id: pack.id,
      sku: pack.sku,
      name: pack.name,
      imageUrl: pack.imageUrl,
      income: data.income,
      fees: data.fees,
      shipping: data.shipping,
      taxes: packTaxes,
      productCost: packProductCost,
      flexCost: data.flexCost,
      gastos: data.gastos,
      salesCount: data.salesCount,
      netIncome: data.income - data.fees - data.shipping - packTaxes - packProductCost - data.flexCost - data.gastos,
      transactionCount: data.count,
      colors,
    });
  }

  packBalances.sort((a, b) => b.income - a.income);

  const packShippingPcts = packBalances
    .filter((p) => p.income > 0 && p.shipping > 0)
    .map((p) => (p.shipping / p.income) * 100);
  const packFeePcts = packBalances
    .filter((p) => p.income > 0 && p.fees > 0)
    .map((p) => (p.fees / p.income) * 100);

  // Determine if any filters are active
  const hasFilters = !!(packIdList.length > 0 || productIdList.length > 0 || params.dateFrom || params.dateTo || params.label);

  const salesCount = allFilteredTransactions.filter((t) => t.label === "sale").length;

  return (
    <div className="space-y-5 max-w-full min-w-0 w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title="Flujo de Caja"
          description="Balance y movimientos financieros"
        />
        <MPSyncButton />
      </div>

      {/* Filters */}
      <CashflowFilters />

      {/* Product filter indicator */}
      {filteredProductName && (
        <div className="filt-bar" style={{ borderColor: "oklch(0.55 0.18 260 / 0.3)" }}>
          <Package className="h-4 w-4" style={{ color: "oklch(0.55 0.18 260)" }} />
          <span className="text-[12px]">
            Filtrando por producto: <strong>{filteredProductName}</strong>
            {productFilteredPackIds && (
              <span className="text-muted-foreground ml-1">
                ({productFilteredPackIds.length} pack{productFilteredPackIds.length !== 1 ? "s" : ""} vinculados)
              </span>
            )}
          </span>
        </div>
      )}

      {/* KPI Cards */}
      {(() => {
        const totalDeducciones = totalFees + totalShipping + totalImpuestos + totalProductCost + totalGastosOp + totalFlexNet + totalReturnShipCost;
        const deductionItems: { label: string; value: number }[] = [
          { label: "Comisiones", value: totalFees },
          { label: "Envios", value: totalShipping },
          { label: "Impuestos", value: totalImpuestos },
          { label: "Costo producto", value: totalProductCost },
          { label: "Gastos", value: totalGastosOp },
          { label: "Flex", value: totalFlexCost },
          ...(totalFlexBonificacion > 0 ? [{ label: "Bonificaciones", value: -totalFlexBonificacion }] : []),
          { label: "Envio devoluciones", value: totalReturnShipCost },
        ].filter((d) => d.value !== 0);

        return (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
            <FinancialCardsWrapper
              totalIncome={totalIncome}
              salesCount={salesCount}
              totalUnits={totalUnits}
              totalDeducciones={totalDeducciones}
              deductionItems={deductionItems}
              serverNet={totalNet}
              serverAvailable={availableToWithdraw}
              serverAdsCost={serverAdsCost}
              totalWithdrawn={totalWithdrawn}
              totalGastos={totalGastosOp}
              totalCompras={totalCompras}
              totalFacturaCost={totalFacturaCost}
              totalFlexCost={totalFlexCost}
              totalFlexBonif={totalFlexBonificacion}
              flexCount={flexCount}
              flexPaidCount={flexPaidCount}
              flexUnpaidCost={flexUnpaidCost}
              totalFlexPaid={totalFlexPaid}
              gastosByAccount={gastosByAccount}
              accounts={accounts}
              showWithdraw={true}
              totalFacturasEmitidas={totalFacturasEmitidas}
              hasFacturaSobreMercancia={hasFacturaSobreMercancia}
            />
          </div>
        );
      })()}

      {/* Partial Refunds — unprocessed */}
      {partialRefunds.length > 0 && (
        <div className="rounded-[9px] border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] uppercase tracking-wider text-amber-700 dark:text-amber-400 font-medium">
              Reembolsos Parciales ({partialRefunds.length})
            </p>
            <span className="text-[10px] text-amber-600 dark:text-amber-500">Stock pendiente de ajustar</span>
          </div>
          <div className="space-y-2">
            {partialRefunds.map((pr) => (
              <div key={pr.id} className="flex items-center justify-between text-[12px] bg-card rounded-md p-2 border border-border">
                <div>
                  <span className="font-mono text-muted-foreground text-[11px]">#{String(pr.mlOrderId)}</span>
                  <span className="ml-2">{pr.mlItemId}</span>
                  <span className="ml-2 text-amber-700 dark:text-amber-400 font-medium">
                    {pr.partialRefundQty} unidad{pr.partialRefundQty > 1 ? "es" : ""} reembolsada{pr.partialRefundQty > 1 ? "s" : ""}
                  </span>
                  <span className="ml-2 text-muted-foreground">(-{formatCurrency(Number(pr.unitPrice) * pr.partialRefundQty)})</span>
                </div>
                <form action={`/api/orders/process-partial-refund`} method="POST">
                  <button
                    type="button"
                    className="text-[11px] font-medium px-2 py-1 rounded-md bg-amber-600 text-white hover:bg-amber-700"
                    onClick={async (e) => {
                      const btn = e.currentTarget;
                      btn.disabled = true;
                      btn.textContent = "...";
                      const res = await fetch("/api/orders/process-partial-refund", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ orderId: pr.id }),
                      });
                      if (res.ok) {
                        btn.textContent = "Hecho";
                        btn.className = "text-[11px] font-medium px-2 py-1 rounded-md bg-green-600 text-white";
                      } else {
                        btn.textContent = "Error";
                        btn.disabled = false;
                      }
                    }}
                  >
                    Ajustar stock
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Devoluciones Detail - Split into two cards */}
      {filteredReturnCount > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Ventas Devueltas — informational only, ML refunds everything */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Ventas Devueltas</p>
              <span className="sw" style={{ background: "oklch(0.55 0.18 25)" }} />
            </div>
            <p className="text-xl font-bold num text-muted-foreground truncate">{formatCurrency(totalReturns)}</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {filteredReturnCount} devolucion{filteredReturnCount !== 1 ? "es" : ""}
              {totalReturnShipCost > 0 && ` · Envio devoluciones -${formatCurrency(totalReturnShipCost)}`}
              {filteredReturnFromFull > 0 ? ` · ${filteredReturnFromFull} desde Full` : ""}
            </p>
          </div>

        </div>
      )}

      {/* Ads Cost */}
      <AdsCostCard />

      {/* Balance por Pack */}
      {packBalances.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-[15px] font-semibold tracking-tight">Balance por Pack</h2>
          <div className="bp-grid">
            {packBalances.map((pack) => {
              const feeRatio = pack.income > 0 ? ((pack.income - pack.netIncome) / pack.income) * 100 : 0;
              const isSelected = packIdList.includes(pack.id);

              const flujoCajaUrl = `/flujo-caja?packIds=${pack.id}${params.dateFrom ? `&dateFrom=${params.dateFrom}` : ""}${params.dateTo ? `&dateTo=${params.dateTo}` : ""}`;

              return (
                <div key={pack.id} className={`bp-card ${isSelected ? "active" : ""}`}>
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <Link href={flujoCajaUrl} className="flex items-center gap-3 min-w-0">
                        {pack.imageUrl && (
                          <div className="shrink-0 h-10 w-10 rounded-md overflow-hidden border bg-muted">
                            <Image
                              src={pack.imageUrl}
                              alt={pack.name}
                              width={40}
                              height={40}
                              className="h-full w-full object-cover"
                              unoptimized
                            />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-[12px] truncate hover:underline">{pack.name}</p>
                          <div className="flex items-center gap-1.5">
                            <p className="mono text-[11px] text-muted-foreground">{pack.sku}</p>
                            {pack.colors.map((c, idx) => {
                              const dotClass = (c.color && COLOR_DOT[c.color]) || (c.label && LABEL_COLOR_DOT[c.label]);
                              if (dotClass) {
                                return (
                                  <span
                                    key={idx}
                                    className={`inline-block h-2.5 w-2.5 rounded-full ${dotClass}`}
                                    title={c.label || (c.color && COLOR_LABEL[c.color]) || ""}
                                  />
                                );
                              }
                              if (c.label) {
                                return (
                                  <span key={idx} className="text-[10px] text-muted-foreground">{c.label}</span>
                                );
                              }
                              return null;
                            })}
                          </div>
                        </div>
                      </Link>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className={`text-lg font-bold num ${pack.netIncome >= 0 ? "margin-good" : "margin-bad"}`}>
                          {formatCurrency(pack.netIncome)}
                        </div>
                        <Link
                          href={`/packs/${pack.id}`}
                          className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-muted border border-transparent hover:border-border"
                          title="Ver detalle del pack"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>

                    {/* Breakdown lines */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11.5px]">
                        <span className="text-muted-foreground">Ingresos</span>
                        <span className="num font-medium margin-good">{formatCurrency(pack.income)}</span>
                      </div>
                      {pack.fees > 0 && (
                        <div className="flex items-center justify-between text-[11.5px]">
                          <span className="text-muted-foreground">Comisiones</span>
                          <span className="num font-medium margin-bad">-{formatCurrency(pack.fees)}</span>
                        </div>
                      )}
                      {pack.shipping > 0 && (
                        <div className="flex items-center justify-between text-[11.5px]">
                          <span className="text-muted-foreground">Envios</span>
                          <span className="num font-medium margin-warn">-{formatCurrency(pack.shipping)}</span>
                        </div>
                      )}
                      {pack.taxes > 0 && (
                        <div className="flex items-center justify-between text-[11.5px]">
                          <span className="text-muted-foreground">Impuestos</span>
                          <span className="num font-medium" style={{ color: "oklch(0.60 0.10 290)" }}>-{formatCurrency(pack.taxes)}</span>
                        </div>
                      )}
                      {pack.productCost > 0 && (
                        <div className="flex items-center justify-between text-[11.5px]">
                          <span className="text-muted-foreground">Costo producto</span>
                          <span className="num font-medium margin-bad">-{formatCurrency(pack.productCost)}</span>
                        </div>
                      )}
                      {pack.flexCost > 0 && (
                        <div className="flex items-center justify-between text-[11.5px]">
                          <span className="text-muted-foreground">Costo Flex</span>
                          <span className="num font-medium margin-warn">-{formatCurrency(pack.flexCost)}</span>
                        </div>
                      )}
                      {pack.gastos > 0 && (
                        <div className="flex items-center justify-between text-[11.5px]">
                          <span className="text-muted-foreground">Gastos</span>
                          <span className="num font-medium margin-bad">-{formatCurrency(pack.gastos)}</span>
                        </div>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div>
                      <div className="h-[5px] w-full rounded-full overflow-hidden" style={{ background: "oklch(0.60 0.16 155 / 0.12)" }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.max(0, 100 - feeRatio)}%`,
                            background: "oklch(0.60 0.16 155)",
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10.5px] text-muted-foreground mt-1">
                        <span>{pack.transactionCount} movimientos</span>
                        <span>{(100 - feeRatio).toFixed(0)}% rentabilidad</span>
                      </div>
                    </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Transaction Table */}
      <div className="rounded-xl border border-border bg-card max-w-full">
        {/* Table header */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 text-[13px] font-semibold">
            <Activity className="h-4 w-4" />
            Movimientos
            {hasFilters && (
              <span className="tx-pill expense">Filtrado</span>
            )}
          </div>
          <p className="text-[12px] text-muted-foreground">
            {totalCount} resultado{totalCount !== 1 ? "s" : ""}
            {relevantExpenses.length > 0 && ` + ${relevantExpenses.length} gasto${relevantExpenses.length > 1 ? "s" : ""}`}
          </p>
        </div>

        {mpTransactions.length === 0 && relevantExpenses.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground py-8 text-center">
            No hay movimientos que coincidan con los filtros.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-[11px] uppercase tracking-wider">Fecha</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider">ID ML</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider">Tipo</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider">Descripcion</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider">Pack</TableHead>
                    <TableHead className="text-right text-[11px] uppercase tracking-wider">Monto</TableHead>
                    <TableHead className="text-right text-[11px] uppercase tracking-wider">Neto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Merge MP transactions + expenses, sort by date desc */}
                  {(() => {
                    const txRows: MovimientoRow[] = mpTransactions.map((tx) => ({
                      kind: "tx" as const,
                      id: tx.id,
                      date: tx.dateCreated,
                      label: tx.label,
                      description: tx.description,
                      mlOrderId: tx.mlOrderId ? String(tx.mlOrderId) : null,
                      mlPackId: tx.mlPackId ? String(tx.mlPackId) : null,
                      amount: Number(tx.amount),
                      balanceChange: Number(tx.balanceChange),
                      type: tx.type,
                      pack: tx.pack,
                    }));
                    const expRows: MovimientoRow[] = relevantExpenses
                      .filter((e) => currentPage === 1)
                      .map((exp) => ({
                        kind: "expense" as const,
                        id: exp.id,
                        date: exp.date,
                        concept: exp.concept,
                        amount: Number(exp.amount),
                        category: exp.category,
                        packIds: exp.resolvedPackIds,
                      }));
                    const allRows = [...txRows, ...expRows].sort((a, b) => b.date.getTime() - a.date.getTime());
                    return allRows.map((row) => {
                      if (row.kind === "expense") {
                        const packSkus = row.packIds
                          .map((pId) => allPacks.find((p) => p.id === pId)?.sku)
                          .filter(Boolean);
                        return (
                          <TableRow key={`exp-${row.id}`} className="hover:bg-muted/50">
                            <TableCell className="text-[12px] text-muted-foreground whitespace-nowrap">
                              {formatDateTime(row.date)}
                            </TableCell>
                            <TableCell className="text-[11px] font-mono text-muted-foreground">-</TableCell>
                            <TableCell>
                              <span className="tx-pill expense">Gasto</span>
                            </TableCell>
                            <TableCell className="font-medium text-[12.5px] max-w-[200px] truncate">
                              {row.concept}
                            </TableCell>
                            <TableCell className="text-[12.5px]">
                              {packSkus.length > 0 ? (
                                <span className="mono text-[11px] text-muted-foreground">{packSkus.join(", ")}</span>
                              ) : (
                                <span className="text-muted-foreground text-[11px]">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right num font-medium whitespace-nowrap">
                              <span className="margin-bad">-{formatCurrency(row.amount)}</span>
                            </TableCell>
                            <TableCell className="text-right num font-medium whitespace-nowrap">
                              <span className="margin-bad">-{formatCurrency(row.amount)}</span>
                            </TableCell>
                          </TableRow>
                        );
                      }
                      const isCredit = row.type === "credit";

                      const labelToPillClass: Record<string, string> = {
                        sale: "tx-pill sale",
                        fee: "tx-pill fee",
                        commission: "tx-pill fee",
                        shipping: "tx-pill shipping",
                        flex_cost: "tx-pill flex",
                        flex_bonificacion: "tx-pill sale",
                      };
                      const labelToText: Record<string, string> = {
                        sale: "Venta",
                        fee: "Comision",
                        commission: "Comision",
                        shipping: "Envio",
                        flex_cost: "Flex",
                        flex_bonificacion: "Bonif. Flex",
                      };

                      return (
                        <TableRow key={row.id} className="hover:bg-muted/50">
                          <TableCell className="text-[12px] text-muted-foreground whitespace-nowrap">
                            {formatDateTime(row.date)}
                          </TableCell>
                          <TableCell className="text-[11px] font-mono text-muted-foreground whitespace-nowrap">
                            <div>{row.mlOrderId || "-"}</div>
                            {row.mlPackId && <div className="text-[10px] text-muted-foreground/60">pack: {row.mlPackId}</div>}
                          </TableCell>
                          <TableCell>
                            <span className={labelToPillClass[row.label] || "tx-pill expense"}>
                              {labelToText[row.label] || row.label}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium text-[12.5px] max-w-[200px] truncate">
                            {row.description || `Movimiento: ${row.label}`}
                          </TableCell>
                          <TableCell className="text-[12.5px]">
                            {row.pack ? (
                              <div className="flex items-center gap-2">
                                {row.pack.imageUrl && (
                                  <div className="shrink-0 h-6 w-6 rounded overflow-hidden border bg-muted">
                                    <Image
                                      src={row.pack.imageUrl}
                                      alt={row.pack.name}
                                      width={24}
                                      height={24}
                                      className="h-full w-full object-cover"
                                      unoptimized
                                    />
                                  </div>
                                )}
                                <Link
                                  href={`/flujo-caja?packIds=${row.pack.id}`}
                                  className="hover:underline mono text-[11px]"
                                >
                                  {row.pack.sku}
                                </Link>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right num font-medium whitespace-nowrap">
                            {row.label === "flex_cost" ? (
                              <FlexCostEditor
                                transactionId={row.id}
                                amount={row.amount}
                                isCredit={isCredit}
                              />
                            ) : (
                              <span className={isCredit ? "margin-good" : "margin-bad"}>
                                {isCredit ? "+" : "-"}{formatCurrency(Math.abs(row.amount))}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right num font-medium whitespace-nowrap">
                            <span className={row.balanceChange >= 0 ? "margin-good" : "margin-bad"}>
                              {row.balanceChange >= 0 ? "+" : ""}{formatCurrency(row.balanceChange)}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })()}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <p className="text-[12px] text-muted-foreground">
                  Pagina {currentPage} de {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  {currentPage > 1 && (
                    <Link
                      href={buildPageUrl(params, currentPage - 1)}
                      className="filt-input hover:border-muted-foreground"
                    >
                      Anterior
                    </Link>
                  )}
                  {generatePageNumbers(currentPage, totalPages).map((pageNum, idx) =>
                    pageNum === null ? (
                      <span key={`ellipsis-${idx}`} className="text-muted-foreground px-1 text-[12px]">...</span>
                    ) : (
                      <Link
                        key={pageNum}
                        href={buildPageUrl(params, pageNum)}
                        className={`filt-input ${pageNum === currentPage ? "active" : ""}`}
                      >
                        {pageNum}
                      </Link>
                    )
                  )}
                  {currentPage < totalPages && (
                    <Link
                      href={buildPageUrl(params, currentPage + 1)}
                      className="filt-input hover:border-muted-foreground"
                    >
                      Siguiente
                    </Link>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function buildPageUrl(
  params: { packId?: string; packIds?: string; productId?: string; productIds?: string; dateFrom?: string; dateTo?: string; label?: string },
  page: number
): string {
  const searchParams = new URLSearchParams();
  if (params.packIds) searchParams.set("packIds", params.packIds);
  else if (params.packId) searchParams.set("packIds", params.packId);
  if (params.productIds) searchParams.set("productIds", params.productIds);
  else if (params.productId) searchParams.set("productId", params.productId);
  if (params.dateFrom) searchParams.set("dateFrom", params.dateFrom);
  if (params.dateTo) searchParams.set("dateTo", params.dateTo);
  if (params.label) searchParams.set("label", params.label);
  if (page > 1) searchParams.set("page", String(page));
  const query = searchParams.toString();
  return `/flujo-caja${query ? `?${query}` : ""}`;
}

function generatePageNumbers(current: number, total: number): (number | null)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | null)[] = [1];

  if (current > 3) pages.push(null);

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) pages.push(null);

  pages.push(total);

  return pages;
}
