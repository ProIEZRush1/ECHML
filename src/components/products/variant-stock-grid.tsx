import { Card, CardContent } from "@/components/ui/card";
import { ColorBadge } from "@/components/shared/color-badge";
import { getStockColor, type ColorKey } from "@/lib/utils";
import type { VariantWithStock } from "@/types";

interface VariantStockGridProps {
  variants: VariantWithStock[];
}

const COLOR_ORDER: ColorKey[] = ["AZUL", "VERDE", "ROSA", "MORADO"];

const BORDER_COLORS: Record<ColorKey, string> = {
  AZUL: "border-l-blue-500",
  VERDE: "border-l-green-500",
  ROSA: "border-l-pink-500",
  MORADO: "border-l-purple-500",
};

export function VariantStockGrid({ variants }: VariantStockGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {COLOR_ORDER.map((color) => {
        const variant = variants.find((v) => v.color === color);
        const stock = variant?.stock ?? 0;
        const stockColorClass = getStockColor(stock);

        return (
          <Card
            key={color}
            className={`border-l-4 ${BORDER_COLORS[color]}`}
          >
            <CardContent className="flex flex-col items-center gap-2 py-6">
              <ColorBadge color={color} />
              <span className={`text-3xl font-bold tabular-nums ${stockColorClass}`}>
                {variant ? stock : "—"}
              </span>
              <span className="text-xs text-muted-foreground">
                {variant ? "unidades" : "Sin variante"}
              </span>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
