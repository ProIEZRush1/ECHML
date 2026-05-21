interface PackItemForCalc {
  quantity: number;
  productVariant: { stock: number; ficticioStock?: number };
}

export function calculatePackStock(items: PackItemForCalc[]): number {
  if (items.length === 0) return 0;

  let minAvailable = Infinity;
  for (const item of items) {
    const canMake = Math.floor(item.productVariant.stock / item.quantity);
    if (canMake < minAvailable) {
      minAvailable = canMake;
    }
  }

  return minAvailable === Infinity ? 0 : minAvailable;
}

export function calculatePackStockWithFicticio(items: PackItemForCalc[]): number {
  if (items.length === 0) return 0;

  let minAvailable = Infinity;
  for (const item of items) {
    const totalStock = item.productVariant.stock + (item.productVariant.ficticioStock || 0);
    const canMake = Math.floor(totalStock / item.quantity);
    if (canMake < minAvailable) {
      minAvailable = canMake;
    }
  }

  return minAvailable === Infinity ? 0 : minAvailable;
}
