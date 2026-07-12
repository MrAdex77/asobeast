"use client";

import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
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
import { formatDayMonth } from "@/lib/format";
import { rankDistributionHistoryOptions } from "@/lib/queries";
import {
  presetToRange,
  VISIBILITY_RANGES,
  type VisibilityRange,
} from "@/lib/ranges";
import { visibilityRangeParser } from "@/lib/search-params";

const BANDS = [
  { key: "rank1", label: "#1", color: "oklch(0.55 0.15 155)" },
  { key: "rank2to3", label: "#2–3", color: "oklch(0.64 0.14 162)" },
  { key: "rank4to10", label: "#4–10", color: "oklch(0.72 0.12 168)" },
  { key: "rank11to50", label: "#11–50", color: "oklch(0.8 0.1 174)" },
  { key: "rank51plus", label: "#51+", color: "oklch(0.86 0.07 180)" },
  { key: "unranked", label: "Unranked", color: "var(--muted-foreground)" },
] as const;

const chartConfig = Object.fromEntries(
  BANDS.map((band) => [band.key, { label: band.label, color: band.color }]),
) satisfies ChartConfig;

function RankDistributionHistoryBody({
  id,
  range,
}: {
  id: string;
  range: VisibilityRange;
}) {
  const { data } = useSuspenseQuery(
    rankDistributionHistoryOptions(id, presetToRange(range)),
  );

  if (data.points.length < 2) {
    return (
      <div className="flex h-[240px] items-center justify-center text-center text-sm text-muted-foreground">
        History appears after a few daily checks.
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-[240px] w-full">
      <AreaChart
        accessibilityLayer
        data={data.points}
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
        <YAxis width={32} tickLine={false} axisLine={false} allowDecimals={false} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) => formatDayMonth(String(value))}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        {BANDS.map((band) => (
          <Area
            key={band.key}
            dataKey={band.key}
            type="monotone"
            stackId="bands"
            stroke={`var(--color-${band.key})`}
            fill={`var(--color-${band.key})`}
            fillOpacity={0.7}
          />
        ))}
      </AreaChart>
    </ChartContainer>
  );
}

export function RankDistributionHistoryChart({ id }: { id: string }) {
  const [range, setRange] = useQueryState("distRange", visibilityRangeParser);

  return (
    <Card>
      <CardHeader>
        <CardDescription>Rank distribution history</CardDescription>
        <CardTitle>Tracked keywords by rank band</CardTitle>
        <CardAction>
          <RangePicker
            presets={VISIBILITY_RANGES}
            value={range}
            onChange={setRange}
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<Skeleton className="h-[240px] w-full" />}>
          <RankDistributionHistoryBody id={id} range={range} />
        </Suspense>
      </CardContent>
    </Card>
  );
}
