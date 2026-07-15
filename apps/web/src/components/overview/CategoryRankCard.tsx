"use client";

import { Suspense } from "react";
import { OVERALL_GENRE, type CategoryRankSeriesItem } from "@asobeast/shared";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
} from "@/components/ui/chart";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RangePicker } from "@/components/rankings/RangePicker";
import { formatCategoryPosition, formatDayMonth } from "@/lib/format";
import { categoryRanksOptions } from "@/lib/queries";
import { presetToRange, RANGE_PRESETS, type RangePreset } from "@/lib/ranges";
import { rangeParser } from "@/lib/search-params";

const PALETTE_SIZE = 5;
const Y_TICKS = [1, 25, 50, 100, 150, 200];

interface CategoryChartData {
  rows: Array<Record<string, string | number | null>>;
  config: ChartConfig;
  keys: string[];
}

function seriesKey(item: CategoryRankSeriesItem): string {
  return `${item.collection}_${item.genre}`;
}

function buildCategoryChart(series: CategoryRankSeriesItem[]): CategoryChartData {
  const dates = new Set<string>();
  for (const item of series) {
    for (const point of item.points) dates.add(point.date);
  }
  const sortedDates = [...dates].sort();

  const config: ChartConfig = {};
  series.forEach((item, index) => {
    config[seriesKey(item)] = {
      label: `${item.genreName} · ${item.collection}`,
      color: `var(--chart-${(index % PALETTE_SIZE) + 1})`,
    };
  });

  const rows = sortedDates.map((date) => {
    const row: Record<string, string | number | null> = { date };
    for (const item of series) {
      const point = item.points.find((candidate) => candidate.date === date);
      row[seriesKey(item)] = point ? point.position : null;
    }
    return row;
  });

  return { rows, config, keys: series.map(seriesKey) };
}

function primaryGenreItem(
  series: CategoryRankSeriesItem[],
): CategoryRankSeriesItem | undefined {
  return series.find((item) => item.genre !== OVERALL_GENRE);
}

function CategoryTooltip({
  active,
  label,
  data,
}: {
  active?: boolean;
  label?: string | number;
  data: CategoryChartData;
}) {
  if (!active || label === undefined) return null;
  const row = data.rows.find((candidate) => candidate.date === label);
  if (!row) return null;

  return (
    <div className="grid min-w-48 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{formatDayMonth(String(label))}</div>
      <div className="grid gap-1.5">
        {data.keys.map((key) => {
          const value = row[key];
          return (
            <div key={key} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span
                  className="size-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: data.config[key]?.color }}
                />
                {data.config[key]?.label ?? key}
              </span>
              <span className="font-mono font-medium tabular-nums text-foreground">
                {formatCategoryPosition(typeof value === "number" ? value : null)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HeaderStat({ series }: { series: CategoryRankSeriesItem[] }) {
  const primary = primaryGenreItem(series);
  if (!primary) return null;

  return (
    <p className="text-sm">
      {primary.current === null ? (
        <span className="text-muted-foreground">
          Not in top 200 in {primary.genreName}
        </span>
      ) : (
        <>
          <span className="font-mono text-lg font-semibold tabular-nums">
            #{primary.current}
          </span>{" "}
          <span className="text-muted-foreground">in {primary.genreName}</span>
        </>
      )}
    </p>
  );
}

function CategoryRankBody({ id, range }: { id: string; range: RangePreset }) {
  const { data } = useSuspenseQuery(
    categoryRanksOptions(id, presetToRange(range)),
  );

  if (data.series.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-center text-sm text-muted-foreground">
        No category captures yet — run the daily pipeline.
      </div>
    );
  }

  const chart = buildCategoryChart(data.series);

  return (
    <div className="flex flex-col gap-4">
      <HeaderStat series={data.series} />
      <ChartContainer config={chart.config} className="h-[300px] w-full">
        <LineChart
          accessibilityLayer
          data={chart.rows}
          margin={{ left: 4, right: 8, top: 8 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
            tickFormatter={(value) => formatDayMonth(String(value))}
          />
          <YAxis
            reversed
            domain={[1, 200]}
            ticks={Y_TICKS}
            width={40}
            tickLine={false}
            axisLine={false}
            allowDataOverflow
          />
          <ChartTooltip content={<CategoryTooltip data={chart} />} />
          <ChartLegend content={<ChartLegendContent />} />
          {chart.keys.map((key) => (
            <Line
              key={key}
              dataKey={key}
              type="monotone"
              stroke={`var(--color-${key})`}
              strokeWidth={2}
              connectNulls={false}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ChartContainer>
    </div>
  );
}

export function CategoryRankCard({ id }: { id: string }) {
  const [range, setRange] = useQueryState("categoryRange", rangeParser);

  return (
    <Card>
      <CardHeader>
        <CardDescription>Category ranks</CardDescription>
        <CardTitle>Top charts position</CardTitle>
        <CardAction>
          <RangePicker
            presets={RANGE_PRESETS}
            value={range}
            onChange={setRange}
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<Skeleton className="h-[300px] w-full" />}>
          <CategoryRankBody id={id} range={range} />
        </Suspense>
      </CardContent>
    </Card>
  );
}
