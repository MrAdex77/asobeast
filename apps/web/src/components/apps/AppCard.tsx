import Link from "next/link";
import type { AppListItem } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate, formatNumber, formatRating, storeLabel } from "@/lib/format";
import { DeleteAppMenu } from "./DeleteAppMenu";

export function AppCard({ app }: { app: AppListItem }) {
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

      <div className="flex items-start gap-4">
        <AppIcon src={app.iconUrl} name={app.name} />
        <div className="flex min-w-0 flex-1 flex-col gap-2 pr-6">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate font-medium">{name}</span>
            <Badge variant="secondary" className="w-fit">
              {storeLabel(app.store)}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {app.ratingAvg !== null ? (
              <span>
                ★ {formatRating(app.ratingAvg)}
                {app.ratingCount !== null
                  ? ` (${formatNumber(app.ratingCount)})`
                  : ""}
              </span>
            ) : null}
            <span>{formatNumber(app.trackedKeywordCount)} keywords</span>
            <span>{formatNumber(app.competitorCount)} competitors</span>
          </div>

          <span className="text-xs text-muted-foreground">
            Updated {formatDate(app.capturedAt)}
          </span>
        </div>
      </div>
    </Card>
  );
}
