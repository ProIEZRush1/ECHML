import type { Color, UserRole, StockChangeType, MLListingStatus } from "@prisma/client";

export type { Color, UserRole, StockChangeType, MLListingStatus };

export interface ProductWithVariants {
  id: string;
  name: string;
  supplierCode: string;
  unitCost: string;
  description: string | null;
  imageUrl: string | null;
  supplier: { id: string; name: string };
  variants: VariantWithStock[];
}

export interface VariantWithStock {
  id: string;
  color: Color;
  stock: number;
  productId: string;
}

export interface PackWithDetails {
  id: string;
  sku: string;
  name: string;
  salePrice: string;
  stock: number;
  description: string | null;
  items: PackItemDetail[];
  mlListings: ListingSummary[];
}

export interface PackItemDetail {
  id: string;
  quantity: number;
  productVariant: {
    id: string;
    color: Color;
    stock: number;
    product: { id: string; name: string; supplierCode: string };
  };
}

export interface ListingSummary {
  id: string;
  mlItemId: string;
  title: string | null;
  status: MLListingStatus;
  currentStock: number;
  currentPrice: string | null;
  lastSyncedAt: Date | null;
}

export interface StockLogEntry {
  id: string;
  changeType: StockChangeType;
  quantityChange: number;
  previousStock: number;
  newStock: number;
  reason: string | null;
  createdAt: Date;
  productVariant: {
    color: Color;
    product: { name: string; supplierCode: string };
  };
  user: { name: string } | null;
}

export interface DashboardStats {
  totalProducts: number;
  totalVariants: number;
  totalPacks: number;
  totalListings: number;
  totalStockValue: number;
  lowStockAlerts: number;
  outOfStockAlerts: number;
}
