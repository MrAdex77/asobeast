"use client";

import Link from "next/link";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toCsv, downloadCsv } from "@/lib/csv";
import { keywordsOptions, rankingsOptions } from "@/lib/queries";
import { presetToRange, RANGE_PRESETS } from "@/lib/ranges";
import { keywordIdsParser, rangeParser } from "@/lib/search-params";
import { buildRankingChart, MAX_SERIES } from "./pivot";
import { KeywordPicker } from "./KeywordPicker";
import { RangePicker } from "./RangePicker";
import { RankingChart } from "./RankingChart";
import { DEFAULT_SELECTION, topByOpportunity } from "./selection";

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
  const [range, setRange] = useQueryState("range", rangeParser);
  const [selected, setSelected] = useQueryState("keywords", keywordIdsParser);
  const { data: tracked } = useSuspenseQuery(keywordsOptions(id));

  const effective =
    selected.length > 0
      ? selected
      : topByOpportunity(tracked, DEFAULT_SELECTION);

  const bounds = presetToRange(range);
  const { data } = useSuspenseQuery(
    rankingsOptions(id, { ...bounds, keywordIds: effective }),
  );

  if (tracked.length === 0) {
    return <EmptyKeywords id={id} />;
  }

  const chart = buildRankingChart(data.series);
  const labels = new Map(tracked.map((item) => [item.keywordId, item.text]));

  const exportRankings = () => {
    const headers = [
      "date",
      ...chart.keywordIds.map((keywordId) => labels.get(keywordId) ?? keywordId),
    ];
    const rows = chart.rows.map((row) => [
      row.date,
      ...chart.keywordIds.map((keywordId) => {
        const value = row[keywordId];
        return value === null || value === undefined ? ">100" : value;
      }),
    ]);
    downloadCsv(
      `rankings-${id}-${bounds.from}-${bounds.to}.csv`,
      toCsv(headers, rows),
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardDescription>Ranking history</CardDescription>
        <CardTitle>Keyword positions over time</CardTitle>
        <CardAction>
          <RangePicker
            presets={RANGE_PRESETS}
            value={range}
            onChange={setRange}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <KeywordPicker id={id} value={effective} onChange={setSelected} />
          {effective.map((keywordId) => (
            <button
              key={keywordId}
              type="button"
              onClick={() =>
                setSelected(effective.filter((item) => item !== keywordId))
              }
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs hover:bg-muted"
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: chart.config[keywordId]?.color }}
              />
              <span className="max-w-40 truncate">
                {labels.get(keywordId) ?? keywordId}
              </span>
              <X className="size-3 opacity-60" />
            </button>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            disabled={chart.rows.length === 0}
            onClick={exportRankings}
            aria-label="Export rankings to CSV"
          >
            <Download />
            Export CSV
          </Button>
        </div>

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
