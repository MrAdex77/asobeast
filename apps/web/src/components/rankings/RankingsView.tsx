"use client";

import Link from "next/link";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { keywordsOptions, rankingsOptions } from "@/lib/queries";
import { presetToRange } from "@/lib/ranges";
import { rangeParser } from "@/lib/search-params";
import { buildRankingChart, MAX_SERIES } from "./pivot";
import { RankingChart } from "./RankingChart";

function EmptyKeywords({ id }: { id: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Track keywords to see their ranking history.
        </p>
        <Button asChild>
          <Link href={`/apps/${id}/keywords`}>Go to keywords</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function RankingsView({ id }: { id: string }) {
  const [range] = useQueryState("range", rangeParser);
  const { data: tracked } = useSuspenseQuery(keywordsOptions(id));
  const { data } = useSuspenseQuery(rankingsOptions(id, presetToRange(range)));

  if (tracked.length === 0) {
    return <EmptyKeywords id={id} />;
  }

  const chart = buildRankingChart(data.series);

  return (
    <Card>
      <CardHeader>
        <CardDescription>Ranking history</CardDescription>
        <CardTitle>Keyword positions over time</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {chart.rows.length > 0 ? (
          <>
            <RankingChart data={chart} />
            {chart.totalSeries > MAX_SERIES ? (
              <p className="text-xs text-muted-foreground">
                Showing {MAX_SERIES} of {chart.totalSeries} keywords.
              </p>
            ) : null}
          </>
        ) : (
          <div className="flex h-[360px] items-center justify-center text-center text-sm text-muted-foreground">
            No ranking data in this range yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
