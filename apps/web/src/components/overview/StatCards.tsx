"use client";

import Link from "next/link";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { appSummaryOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";

function TrendChip({ label, value }: { label: string; value: number | null }) {
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

export function StatCards({ id }: { id: string }) {
  const { data: summary } = useSuspenseQuery(appSummaryOptions(id));

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader>
          <CardDescription>Visibility</CardDescription>
          <CardTitle className="text-3xl tabular-nums">
            {Math.round(summary.visibility.current)}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3">
          <TrendChip label="7d" value={summary.visibility.delta7d} />
          <TrendChip label="30d" value={summary.visibility.delta30d} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Tracked keywords</CardDescription>
          <CardTitle className="text-3xl tabular-nums">
            {summary.trackedKeywords}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          {summary.rankDistribution.top10} in top 10
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Competitors</CardDescription>
          <CardTitle className="text-3xl tabular-nums">
            {summary.competitors}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Link
            href={`/apps/${id}/competitors`}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            View comparison
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Last refresh</CardDescription>
          <CardTitle className="text-xl">
            {summary.lastRefreshAt ? formatDate(summary.lastRefreshAt) : "never"}
          </CardTitle>
        </CardHeader>
      </Card>
    </div>
  );
}
