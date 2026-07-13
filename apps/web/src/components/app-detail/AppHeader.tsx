"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import type { AppDetail } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { Badge } from "@/components/ui/badge";
import { appDetailOptions } from "@/lib/queries";
import {
  formatCountry,
  formatNumber,
  formatPrice,
  formatRating,
  storeLabel,
} from "@/lib/format";
import { RefreshAction } from "./RefreshAction";
import { RunDailyAction } from "./RunDailyAction";

function storeUrl(detail: AppDetail): string {
  if (detail.store === "GOOGLE_PLAY") {
    return `https://play.google.com/store/apps/details?id=${detail.storeAppId}`;
  }
  return `https://apps.apple.com/${detail.country}/app/id${detail.storeAppId}`;
}

export function AppHeader({ id }: { id: string }) {
  const { data: detail } = useSuspenseQuery(appDetailOptions(id));
  const name = detail.name ?? "Untitled app";
  const snapshot = detail.latestSnapshot;

  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <AppIcon src={detail.iconUrl} name={detail.name} size={64} />
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">{storeLabel(detail.store)}</Badge>
              <Badge variant="outline" title={formatCountry(detail.country)}>
                {detail.country.toUpperCase()}
              </Badge>
              <a
                href={storeUrl(detail)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                Store page
                <ExternalLink className="size-3.5" />
              </a>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <RefreshAction appId={detail.id} />
          <RunDailyAction appId={detail.id} />
        </div>
      </div>

      {snapshot ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {snapshot.ratingAvg !== null ? (
            <span>
              ★ {formatRating(snapshot.ratingAvg)}
              {snapshot.ratingCount !== null
                ? ` (${formatNumber(snapshot.ratingCount)})`
                : ""}
            </span>
          ) : null}
          {snapshot.version ? <span>v{snapshot.version}</span> : null}
          {snapshot.price !== null ? (
            <span>{formatPrice(snapshot.price)}</span>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
