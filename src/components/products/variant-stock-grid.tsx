import { Card, CardContent } from "@/components/ui/card";
import { ColorBadge } from "@/components/shared/color-badge";
import { getStockColor, getVariantDisplay } from "@/lib/utils";
import type { VariantWithStock } from "@/types";

interface VariantStockGridProps {
  variants: VariantWithStock[];
}

export function VariantStockGrid({ variants }: VariantStockGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {variants.map((variant) => {
        const display = getVariantDisplay(variant);
        const stockColorClass = getStockColor(variant.stock);

        return (
          <Card
            key={variant.id}
            className="border-l-4"
            style={{ borderLeftColor: display.hex }}
          >
            <CardContent className="flex flex-col items-center gap-2 py-6">
              <ColorBadge color={variant.color} variantLabel={variant.variantLabel} />
              <span className={`text-3xl font-bold tabular-nums ${stockColorClass}`}>
                {variant.stock}
              </span>
              <span className="text-xs text-muted-foreground">unidades</span>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
