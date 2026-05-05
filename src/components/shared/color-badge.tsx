"use client";

import { getVariantDisplay } from "@/lib/utils";
import type { Color } from "@prisma/client";

interface ColorBadgeProps {
  color?: Color | null;
  variantLabel?: string | null;
  showLabel?: boolean;
}

export function ColorBadge({ color, variantLabel, showLabel = true }: ColorBadgeProps) {
  const display = getVariantDisplay({ color, variantLabel });

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-block size-3 rounded-full ${display.bg}`}
        aria-hidden="true"
      />
      {showLabel && (
        <span className={`text-sm font-medium ${display.text}`}>
          {display.label}
        </span>
      )}
    </div>
  );
}
