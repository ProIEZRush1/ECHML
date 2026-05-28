import { ColorBadge } from "@/components/shared/color-badge";
import { getVariantDisplay } from "@/lib/utils";
import type { VariantWithStock } from "@/types";

interface VariantStockGridProps {
  variants: VariantWithStock[];
}

export function VariantStockGrid({ variants }: VariantStockGridProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {variants.map((variant) => {
        const display = getVariantDisplay(variant);

        return (
          <div
            key={variant.id}
            className="rounded-xl border border-border bg-card overflow-hidden border-l-4 flex flex-col items-center gap-2 py-6"
            style={{ borderLeftColor: display.hex }}
          >
            <ColorBadge color={variant.color} variantLabel={variant.variantLabel} />
            <span
              className={`mono num text-3xl font-bold tabular-nums ${
                variant.stock === 0
                  ? "text-destructive"
                  : variant.stock <= 5
                    ? "text-[oklch(0.48_0.13_70)]"
                    : "text-success"
              }`}
            >
              {variant.stock}
            </span>
            <span className="text-[11px] text-muted-foreground">unidades</span>
          </div>
        );
      })}
    </div>
  );
}
