import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export function TrendChip({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  if (value === null) {
    return (
      <span className="text-xs text-muted-foreground">no {label} data</span>
    );
  }

  const rounded = Math.round(value);
  const Icon = rounded > 0 ? ArrowUp : rounded < 0 ? ArrowDown : Minus;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
        rounded > 0 && "text-emerald-600 dark:text-emerald-400",
        rounded < 0 && "text-red-600 dark:text-red-400",
        rounded === 0 && "text-muted-foreground",
      )}
    >
      <Icon className="size-3.5" />
      {rounded > 0 ? `+${rounded}` : rounded} {label}
    </span>
  );
}
