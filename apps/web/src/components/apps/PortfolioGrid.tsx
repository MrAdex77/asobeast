import Link from "next/link";
import type { PortfolioApp } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { TrendChip } from "@/components/overview/TrendChip";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  formatCountry,
  formatDate,
  formatNumber,
  storeLabel,
} from "@/lib/format";
import { DeleteAppMenu } from "./DeleteAppMenu";
import { Sparkline } from "./Sparkline";

function PortfolioCard({ app }: { app: PortfolioApp }) {
  const name = app.name ?? "Untitled app";

  return (
    <Card className="relative gap-0 p-4 transition-colors hover:bg-muted/40">
      <Link
        href={`/apps/${app.id}`}
        className="absolute inset-0 z-10 rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <span className="sr-only">{name}</span>
      </Link>

      <div className="absolute top-2 right-2 z-20">
        <DeleteAppMenu id={app.id} name={name} />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-4">
          <AppIcon src={app.iconUrl} name={app.name} />
          <div className="flex min-w-0 flex-1 flex-col gap-1 pr-6">
            <span className="truncate font-medium">{name}</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="w-fit">
                {storeLabel(app.store)}
              </Badge>
              <Badge
                variant="outline"
                className="w-fit"
                title={formatCountry(app.country)}
              >
                {app.country.toUpperCase()}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-end justify-between gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-3xl font-semibold tabular-nums">
              {Math.round(app.visibility.current)}
            </span>
            <TrendChip label="7d" value={app.visibility.delta7d} />
          </div>
        </div>

        <Sparkline points={app.sparkline} />

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{formatNumber(app.trackedKeywords)} keywords</span>
          <span>{formatNumber(app.competitors)} competitors</span>
          <span>Updated {formatDate(app.lastCapturedAt)}</span>
        </div>
      </div>
    </Card>
  );
}

export function PortfolioGrid({ apps }: { apps: PortfolioApp[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {apps.map((app) => (
        <li key={app.id}>
          <PortfolioCard app={app} />
        </li>
      ))}
    </ul>
  );
}
