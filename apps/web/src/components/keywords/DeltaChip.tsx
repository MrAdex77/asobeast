import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function DeltaChip({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (value === 0) {
    return <span className="text-muted-foreground tabular-nums">0</span>;
  }
  const improved = value < 0;
  const Icon = improved ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-medium tabular-nums",
        improved
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-red-600 dark:text-red-400",
      )}
    >
      <Icon className="size-3.5" />
      {Math.abs(value)}
    </span>
  );
}

export function PositionDeltaChip({ value }: { value: number | null }) {
  if (value === null || value === 0) {
    return null;
  }
  const improved = value < 0;
  const Icon = improved ? ArrowUp : ArrowDown;
  const magnitude = Math.abs(value);
  return (
    <span
      aria-label={`${improved ? "up" : "down"} ${magnitude} since yesterday`}
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
        improved
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-red-600 dark:text-red-400",
      )}
    >
      <Icon className="size-3" aria-hidden />
      {magnitude}
    </span>
  );
}
