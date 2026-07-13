import type { PortfolioTotals as Totals } from "@asobeast/shared";
import { formatNumber } from "@/lib/format";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-2xl font-semibold tabular-nums">
        {formatNumber(value)}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export function PortfolioTotals({ totals }: { totals: Totals }) {
  return (
    <div className="grid grid-cols-2 gap-4 rounded-xl border p-4 sm:grid-cols-4">
      <Stat label="Apps" value={totals.apps} />
      <Stat label="Tracked keywords" value={totals.trackedKeywords} />
      <Stat label="Competitors" value={totals.competitors} />
      <Stat label="Changes this week" value={totals.changes7d} />
    </div>
  );
}
