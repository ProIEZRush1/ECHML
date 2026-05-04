interface PackItemForCalc {
  quantity: number;
  productVariant: { stock: number };
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
