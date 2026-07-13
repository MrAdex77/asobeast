"use client";

import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
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
import { ratingsHistoryOptions } from "@/lib/queries";
import { presetToRange, RATINGS_RANGES, type RatingsRange } from "@/lib/ranges";
import { ratingsRangeParser } from "@/lib/search-params";

const chartConfig = {
  ratingAvg: { label: "Average rating", color: "var(--chart-1)" },
  ratingCount: { label: "Rating count", color: "var(--chart-2)" },
} satisfies ChartConfig;

function RatingsChartBody({ id, range }: { id: string; range: RatingsRange }) {
  const { data } = useSuspenseQuery(
    ratingsHistoryOptions(id, presetToRange(range)),
  );

  if (data.points.length < 2) {
    return (
      <div className="flex h-[240px] items-center justify-center text-center text-sm text-muted-foreground">
        Not enough ratings history yet — snapshots accrue with the daily
        pipeline.
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-[240px] w-full">
      <LineChart
        accessibilityLayer
        data={data.points}
        margin={{ left: 4, right: 4, top: 8 }}
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
          yAxisId="avg"
          domain={[0, 5]}
          width={32}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          yAxisId="count"
          orientation="right"
          width={40}
          tickLine={false}
          axisLine={false}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) => formatDayMonth(String(value))}
            />
          }
        />
        <Line
          yAxisId="avg"
          dataKey="ratingAvg"
          type="monotone"
          stroke="var(--color-ratingAvg)"
          dot={false}
          connectNulls
        />
        <Line
          yAxisId="count"
          dataKey="ratingCount"
          type="monotone"
          stroke="var(--color-ratingCount)"
          dot={false}
          connectNulls
        />
      </LineChart>
    </ChartContainer>
  );
}

export function RatingsChart({ id }: { id: string }) {
  const [range, setRange] = useQueryState("range", ratingsRangeParser);

  return (
    <Card>
      <CardHeader>
        <CardDescription>Ratings history</CardDescription>
        <CardTitle>Average rating and volume over time</CardTitle>
        <CardAction>
          <RangePicker
            presets={RATINGS_RANGES}
            value={range}
            onChange={setRange}
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<Skeleton className="h-[240px] w-full" />}>
          <RatingsChartBody id={id} range={range} />
        </Suspense>
      </CardContent>
    </Card>
  );
}
