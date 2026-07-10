"use client";

import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
import { visibilityOptions } from "@/lib/queries";
import {
  presetToRange,
  VISIBILITY_RANGES,
  type VisibilityRange,
} from "@/lib/ranges";
import { visibilityRangeParser } from "@/lib/search-params";

const chartConfig = {
  visibility: { label: "Visibility", color: "var(--chart-1)" },
} satisfies ChartConfig;

function VisibilityChartBody({
  id,
  range,
}: {
  id: string;
  range: VisibilityRange;
}) {
  const { data } = useSuspenseQuery(visibilityOptions(id, presetToRange(range)));

  if (data.points.length < 2) {
    return (
      <div className="flex h-[240px] items-center justify-center text-center text-sm text-muted-foreground">
        Not enough history yet — run the daily pipeline.
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
        <YAxis width={32} tickLine={false} axisLine={false} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) => formatDayMonth(String(value))}
            />
          }
        />
        <Area
          dataKey="visibility"
          type="monotone"
          stroke="var(--color-visibility)"
          fill="var(--color-visibility)"
          fillOpacity={0.2}
        />
      </AreaChart>
    </ChartContainer>
  );
}

export function VisibilityChart({ id }: { id: string }) {
  const [range, setRange] = useQueryState("range", visibilityRangeParser);

  return (
    <Card>
      <CardHeader>
        <CardDescription>Visibility history</CardDescription>
        <CardTitle>Search visibility over time</CardTitle>
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
          <VisibilityChartBody id={id} range={range} />
        </Suspense>
      </CardContent>
    </Card>
  );
}
