"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import type { AppDetail } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { appDetailOptions } from "@/lib/queries";
import { storeLabel } from "@/lib/format";

function storeUrl(detail: AppDetail): string {
  if (detail.store === "GOOGLE_PLAY") {
    return `https://play.google.com/store/apps/details?id=${detail.storeAppId}`;
  }
  return `https://apps.apple.com/${detail.country}/app/id${detail.storeAppId}`;
}

export function AppHeader({ id }: { id: string }) {
  const { data: detail } = useSuspenseQuery(appDetailOptions(id));
  const name = detail.name ?? "Untitled app";

  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-center gap-4">
        <AppIcon src={detail.iconUrl} name={detail.name} size={64} />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{storeLabel(detail.store)}</Badge>
            <span className="uppercase">{detail.country}</span>
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
        <Button variant="outline" disabled>
          Refresh
        </Button>
        <Button variant="outline" disabled>
          Run daily
        </Button>
      </div>
    </header>
  );
}
