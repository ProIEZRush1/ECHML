import { COLOR_MAP, type ColorKey } from "@/lib/utils";

interface ColorBadgeProps {
  color: ColorKey;
  showLabel?: boolean;
}

export function ColorBadge({ color, showLabel = true }: ColorBadgeProps) {
  const colorInfo = COLOR_MAP[color];

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-block size-3 rounded-full ${colorInfo.bg}`}
        aria-hidden="true"
      />
      {showLabel && (
        <span className={`text-sm font-medium ${colorInfo.text}`}>
          {colorInfo.label}
        </span>
      )}
    </div>
  );
}
