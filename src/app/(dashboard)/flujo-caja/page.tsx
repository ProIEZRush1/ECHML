export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  Percent,
  Truck,
  Wallet,
  Activity,
  Package,
  ShoppingBag,
  Receipt,
  Landmark,
  Megaphone,
  Bike,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { mlFetch } from "@/lib/ml/client";
import { MPSyncButton } from "./mp-sync-button";
import { CashflowFilters } from "./cashflow-filters";
import { AdsCostCard } from "./ads-cost-card";
import Link from "next/link";
import Image from "next/image";

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
  salesCount: number;
  netIncome: number;
  transactionCount: number;
}

async function fetchAdsCost(
  dateFrom: string,
  dateTo: string,
  packIds: string[],
  productIds: string[]
): Promise<number> {
  try {
    const advertiserId = 853025;
    if (packIds.length === 0 && productIds.length === 0) {
      const data = await mlFetch<{ metrics_summary?: { cost: number }; paging: { total: number } }>(
        `/advertising/MLM/advertisers/${advertiserId}/product_ads/ads/search?limit=1&offset=0&date_from=${dateFrom}&date_to=${dateTo}&filters[statuses]=active,paused,hold,idle&metrics=cost&metrics_summary=true`,
        { headers: { "api-version": "2" } }
      );
      return data.metrics_summary?.cost || 0;
    }
    const allItems: Array<{ item_id: string; metrics: { cost: number } }> = [];
    let offset = 0;
    const limit = 50;
    let total = Infinity;
    while (offset < total) {
      const data = await mlFetch<{ results: typeof allItems; paging: { total: number } }>(
        `/advertising/MLM/advertisers/${advertiserId}/product_ads/ads/search?limit=${limit}&offset=${offset}&date_from=${dateFrom}&date_to=${dateTo}&filters[statuses]=active,paused,hold,idle&metrics=cost`,
        { headers: { "api-version": "2" } }
      );
      total = data.paging.total;
      allItems.push(...data.results);
      offset += limit;
    }
    const allowedItemIds = new Set<string>();
    if (productIds.length > 0) {
      const packItems = await prisma.packItem.findMany({
        where: { productVariant: { productId: { in: productIds } } },
        select: { packId: true },
      });
      const linkedPackIds = [...new Set(packItems.map((pi) => pi.packId))];
      const linkedListings = await prisma.mLListing.findMany({
        where: { packId: { in: linkedPackIds } },
        select: { mlItemId: true },
      });
      linkedListings.forEach((l) => allowedItemIds.add(l.mlItemId));
    }
    if (packIds.length > 0) {
      const packListings = await prisma.mLListing.findMany({
        where: { packId: { in: packIds } },
        select: { mlItemId: true },
      });
      packListings.forEach((l) => allowedItemIds.add(l.mlItemId));
    }
    return allItems
      .filter((item) => allowedItemIds.has(item.item_id))
      .reduce((sum, item) => sum + (item.metrics?.cost || 0), 0);
  } catch {
    return 0;
  }
}

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
  if (productIdList.length > 0) {
    const [packItems, product] = await Promise.all([
      prisma.packItem.findMany({
        where: { productVariant: { productId: { in: productIdList } } },
        select: { packId: true },
      }),
      prisma.product.findFirst({
        where: { id: { in: productIdList } },
        select: { name: true, brand: true },
      }),
    ]);
    productFilteredPackIds = [...new Set(packItems.map((pi) => pi.packId))];
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

  // Fetch filtered data
  const effectiveDateTo = params.dateTo || new Date().toISOString().split("T")[0];

  const [mpTransactions, totalCount, allPacks, packsWithCosts, filteredExpenses, totalAdsCost] = await Promise.all([
    prisma.mPTransaction.findMany({
      where,
      orderBy: { dateCreated: "desc" },
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
      include: {
        pack: { select: { id: true, sku: true, name: true, imageUrl: true } },
      },
    }),
    prisma.mPTransaction.count({ where }),
    prisma.pack.findMany({
      select: { id: true, sku: true, name: true, imageUrl: true },
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
        type: "gasto",
        date: {
          gte: new Date(`${effectiveDateFrom}T00:00:00.000Z`),
          ...(params.dateTo ? { lte: new Date(`${params.dateTo}T23:59:59.999Z`) } : {}),
        },
        ...(effectivePackIds.length > 0 ? { packId: effectivePackIds.length === 1 ? effectivePackIds[0] : { in: effectivePackIds } } : {}),
        ...(productIdList.length > 0 ? { productId: { in: productIdList } } : {}),
      },
      select: { amount: true },
    }),
    Promise.race([
      fetchAdsCost(effectiveDateFrom, effectiveDateTo, effectivePackIds, productIdList),
      new Promise<number>((resolve) => setTimeout(() => resolve(0), 4000)),
    ]),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  // Aggregate KPIs with same filters (no pagination)
  const allFilteredTransactions = await prisma.mPTransaction.findMany({
    where,
    select: {
      amount: true,
      label: true,
      type: true,
      packId: true,
    },
  });

  // Build pack cost map: packId → cost per unit sold
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
  const salesPerPack = new Map<string, number>();

  for (const tx of allFilteredTransactions) {
    const amount = Number(tx.amount);
    if (tx.label === "sale") {
      totalIncome += amount;
      if (tx.packId) {
        salesPerPack.set(tx.packId, (salesPerPack.get(tx.packId) || 0) + 1);
      }
    } else if (tx.label === "fee" || tx.label === "commission") {
      totalFees += Math.abs(amount);
    } else if (tx.label === "shipping") {
      totalShipping += Math.abs(amount);
    } else if (tx.label === "flex_cost") {
      totalFlexCost += Math.abs(amount);
    }
  }

  for (const [packId, count] of salesPerPack) {
    const costPerUnit = packCostMap.get(packId) || 0;
    totalProductCost += costPerUnit * count;
  }

  // Tax calculation (Mexico RESICO regime)
  // IVA withholding: 8% of base (sale / 1.16)
  // ISR withholding: 2.5% of base
  const totalBase = totalIncome / 1.16;
  const totalRetencionIVA = totalBase * 0.08;
  const totalRetencionISR = totalBase * 0.025;
  const totalImpuestos = totalRetencionIVA + totalRetencionISR;

  const totalGastos = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const flexCount = allFilteredTransactions.filter((t) => t.label === "flex_cost").length;
  const totalNet = totalIncome - totalFees - totalShipping - totalImpuestos - totalProductCost - totalGastos - totalAdsCost - totalFlexCost;

  // Calculate balance per pack — apply same pack filter as KPI cards
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

  const packTransactions = await prisma.mPTransaction.findMany({
    where: packWhere,
    select: {
      amount: true,
      label: true,
      packId: true,
    },
  });

  // Aggregate by pack
  const packMap = new Map<
    string,
    { income: number; fees: number; shipping: number; flexCost: number; salesCount: number; count: number }
  >();

  for (const tx of packTransactions) {
    if (!tx.packId) continue;
    const existing = packMap.get(tx.packId) || { income: 0, fees: 0, shipping: 0, flexCost: 0, salesCount: 0, count: 0 };
    const amount = Number(tx.amount);

    if (tx.label === "sale") {
      existing.income += amount;
      existing.salesCount += 1;
    } else if (tx.label === "fee" || tx.label === "commission") {
      existing.fees += Math.abs(amount);
    } else if (tx.label === "shipping") {
      existing.shipping += Math.abs(amount);
    } else if (tx.label === "flex_cost") {
      existing.flexCost += Math.abs(amount);
    }
    existing.count += 1;
    packMap.set(tx.packId, existing);
  }

  // Build pack balances with taxes and product cost
  const packBalances: PackBalance[] = [];
  for (const pack of allPacks) {
    const data = packMap.get(pack.id);
    if (!data) continue;

    const packBase = data.income / 1.16;
    const packTaxes = packBase * 0.08 + packBase * 0.025;
    const packProductCost = (packCostMap.get(pack.id) || 0) * data.salesCount;

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
      salesCount: data.salesCount,
      netIncome: data.income - data.fees - data.shipping - packTaxes - packProductCost - data.flexCost,
      transactionCount: data.count,
    });
  }

  packBalances.sort((a, b) => b.income - a.income);

  // Determine if any filters are active
  const hasFilters = !!(packIdList.length > 0 || productIdList.length > 0 || params.dateFrom || params.dateTo || params.label);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
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
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-4 py-2">
          <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm text-blue-800 dark:text-blue-300">
            Filtrando por producto: <strong>{filteredProductName}</strong>
            {productFilteredPackIds && (
              <span className="text-blue-600 dark:text-blue-400 ml-1">
                ({productFilteredPackIds.length} pack{productFilteredPackIds.length !== 1 ? "s" : ""} vinculados)
              </span>
            )}
          </span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ingresos
            </CardTitle>
            <div className="rounded-md p-2 bg-green-100 dark:bg-green-900/30">
              <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-green-600 dark:text-green-400 truncate">
              {formatCurrency(totalIncome)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {allFilteredTransactions.filter((t) => t.label === "sale").length} ventas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Comisiones
            </CardTitle>
            <div className="rounded-md p-2 bg-purple-100 dark:bg-purple-900/30">
              <Percent className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-purple-600 dark:text-purple-400 truncate">
              -{formatCurrency(totalFees)}
            </div>
            {totalIncome > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {((totalFees / totalIncome) * 100).toFixed(1)}% de ingresos
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Envios
            </CardTitle>
            <div className="rounded-md p-2 bg-orange-100 dark:bg-orange-900/30">
              <Truck className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-orange-600 dark:text-orange-400 truncate">
              -{formatCurrency(totalShipping)}
            </div>
            {totalIncome > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {((totalShipping / totalIncome) * 100).toFixed(1)}% de ingresos
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Impuestos
            </CardTitle>
            <div className="rounded-md p-2 bg-amber-100 dark:bg-amber-900/30">
              <Landmark className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400 truncate">
              -{formatCurrency(totalImpuestos)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              IVA {formatCurrency(totalRetencionIVA)} + ISR {formatCurrency(totalRetencionISR)}
            </p>
          </CardContent>
        </Card>

        {totalProductCost > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Costo Producto
              </CardTitle>
              <div className="rounded-md p-2 bg-red-100 dark:bg-red-900/30">
                <ShoppingBag className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-red-600 dark:text-red-400 truncate">
                -{formatCurrency(totalProductCost)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Costo de mercancia vendida
              </p>
            </CardContent>
          </Card>
        )}

        {totalGastos > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Gastos
              </CardTitle>
              <div className="rounded-md p-2 bg-rose-100 dark:bg-rose-900/30">
                <Receipt className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-rose-600 dark:text-rose-400 truncate">
                -{formatCurrency(totalGastos)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Gastos operativos del periodo
              </p>
            </CardContent>
          </Card>
        )}

        {totalAdsCost > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Publicidad
              </CardTitle>
              <div className="rounded-md p-2 bg-pink-100 dark:bg-pink-900/30">
                <Megaphone className="h-4 w-4 text-pink-600 dark:text-pink-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-pink-600 dark:text-pink-400 truncate">
                -{formatCurrency(totalAdsCost)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Costo de ads del periodo
              </p>
            </CardContent>
          </Card>
        )}

        {totalFlexCost > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Costo Flex
              </CardTitle>
              <div className="rounded-md p-2 bg-cyan-100 dark:bg-cyan-900/30">
                <Bike className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-cyan-600 dark:text-cyan-400 truncate">
                -{formatCurrency(totalFlexCost)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {flexCount} envio{flexCount !== 1 ? "s" : ""} Flex · $115 c/u
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Utilidad Neta
            </CardTitle>
            <div className="rounded-md p-2 bg-blue-100 dark:bg-blue-900/30">
              <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold truncate ${totalNet >= 0 ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400"}`}>
              {formatCurrency(totalNet)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Todo: comisiones, envios, impuestos, costo, gastos, ads, flex
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ads Cost */}
      <AdsCostCard />

      {/* Balance por Pack */}
      {packBalances.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">Balance por Pack</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {packBalances.map((pack) => {
              const feeRatio = pack.income > 0 ? ((pack.income - pack.netIncome) / pack.income) * 100 : 0;
              const isSelected = packIdList.includes(pack.id);

              return (
                <Link
                  key={pack.id}
                  href={`/flujo-caja?packIds=${pack.id}${params.dateFrom ? `&dateFrom=${params.dateFrom}` : ""}${params.dateTo ? `&dateTo=${params.dateTo}` : ""}`}
                  className="block"
                >
                  <Card className={`transition-all hover:shadow-md hover:border-primary/30 cursor-pointer ${isSelected ? "border-primary ring-2 ring-primary/20" : ""}`}>
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
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
                              <p className="font-medium text-sm truncate">{pack.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{pack.sku}</p>
                            </div>
                          </div>
                          <div className={`text-lg font-bold shrink-0 ${pack.netIncome >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                            {formatCurrency(pack.netIncome)}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Ingresos</span>
                            <span className="font-medium text-green-600 dark:text-green-400">
                              {formatCurrency(pack.income)}
                            </span>
                          </div>
                          {pack.fees > 0 && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Comisiones</span>
                              <span className="font-medium text-purple-600 dark:text-purple-400">
                                -{formatCurrency(pack.fees)}
                              </span>
                            </div>
                          )}
                          {pack.shipping > 0 && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Envios</span>
                              <span className="font-medium text-orange-600 dark:text-orange-400">
                                -{formatCurrency(pack.shipping)}
                              </span>
                            </div>
                          )}
                          {pack.taxes > 0 && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Impuestos</span>
                              <span className="font-medium text-amber-600 dark:text-amber-400">
                                -{formatCurrency(pack.taxes)}
                              </span>
                            </div>
                          )}
                          {pack.productCost > 0 && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Costo producto</span>
                              <span className="font-medium text-red-600 dark:text-red-400">
                                -{formatCurrency(pack.productCost)}
                              </span>
                            </div>
                          )}
                          {pack.flexCost > 0 && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Costo Flex</span>
                              <span className="font-medium text-cyan-600 dark:text-cyan-400">
                                -{formatCurrency(pack.flexCost)}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Progress bar: income vs fees ratio */}
                        <div className="h-2 w-full rounded-full bg-green-100 dark:bg-green-900/30 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-green-500 dark:bg-green-400 transition-all"
                            style={{ width: `${Math.max(0, 100 - feeRatio)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{pack.transactionCount} movimientos</span>
                          <span>{(100 - feeRatio).toFixed(0)}% rentabilidad</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Transaction Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              Movimientos
              {hasFilters && (
                <Badge variant="secondary" className="text-xs font-normal">
                  Filtrado
                </Badge>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {totalCount} resultado{totalCount !== 1 ? "s" : ""}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {mpTransactions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No hay movimientos que coincidan con los filtros.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descripcion</TableHead>
                    <TableHead>Pack</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-right">Neto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mpTransactions.map((tx) => {
                    const amount = Number(tx.amount);
                    const balance = Number(tx.balanceChange);
                    const isCredit = tx.type === "credit";

                    return (
                      <TableRow key={tx.id} className="hover:bg-muted/50">
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(tx.dateCreated)}
                        </TableCell>
                        <TableCell>
                          {tx.label === "sale" && (
                            <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-100">
                              Venta
                            </Badge>
                          )}
                          {(tx.label === "fee" || tx.label === "commission") && (
                            <Badge variant="default" className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 hover:bg-purple-100">
                              Comision
                            </Badge>
                          )}
                          {tx.label === "shipping" && (
                            <Badge variant="default" className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 hover:bg-orange-100">
                              Envio
                            </Badge>
                          )}
                          {tx.label === "flex_cost" && (
                            <Badge variant="default" className="bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300 hover:bg-cyan-100">
                              Flex
                            </Badge>
                          )}
                          {!["sale", "fee", "commission", "shipping", "flex_cost"].includes(tx.label) && (
                            <Badge variant="default" className="bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300 hover:bg-slate-100">
                              {tx.label}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-medium text-sm max-w-[200px] truncate">
                          {tx.description || `Movimiento: ${tx.label}`}
                        </TableCell>
                        <TableCell className="text-sm">
                          {tx.pack ? (
                            <div className="flex items-center gap-2">
                              {tx.pack.imageUrl && (
                                <div className="shrink-0 h-6 w-6 rounded overflow-hidden border bg-muted">
                                  <Image
                                    src={tx.pack.imageUrl}
                                    alt={tx.pack.name}
                                    width={24}
                                    height={24}
                                    className="h-full w-full object-cover"
                                    unoptimized
                                  />
                                </div>
                              )}
                              <Link
                                href={`/flujo-caja?packIds=${tx.pack.id}`}
                                className="text-primary hover:underline font-mono text-xs"
                              >
                                {tx.pack.sku}
                              </Link>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium whitespace-nowrap">
                          <span className={isCredit ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                            {isCredit ? "+" : "-"}{formatCurrency(Math.abs(amount))}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium whitespace-nowrap">
                          <span className={balance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                            {balance >= 0 ? "+" : ""}{formatCurrency(balance)}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Pagina {currentPage} de {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    {currentPage > 1 && (
                      <Link
                        href={buildPageUrl(params, currentPage - 1)}
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
                      >
                        Anterior
                      </Link>
                    )}
                    {/* Page numbers */}
                    {generatePageNumbers(currentPage, totalPages).map((pageNum, idx) =>
                      pageNum === null ? (
                        <span key={`ellipsis-${idx}`} className="text-muted-foreground px-1">...</span>
                      ) : (
                        <Link
                          key={pageNum}
                          href={buildPageUrl(params, pageNum)}
                          className={`inline-flex items-center justify-center rounded-md text-sm font-medium h-9 w-9 ${
                            pageNum === currentPage
                              ? "bg-primary text-primary-foreground"
                              : "border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                          }`}
                        >
                          {pageNum}
                        </Link>
                      )
                    )}
                    {currentPage < totalPages && (
                      <Link
                        href={buildPageUrl(params, currentPage + 1)}
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
                      >
                        Siguiente
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
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
