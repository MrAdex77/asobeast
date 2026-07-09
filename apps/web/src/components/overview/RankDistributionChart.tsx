"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { appSummaryOptions } from "@/lib/queries";

const BUCKETS = [
  { key: "top1", label: "Top 1" },
  { key: "top3", label: "Top 3" },
  { key: "top10", label: "Top 10" },
  { key: "top50", label: "Top 50" },
  { key: "beyond", label: "Beyond" },
  { key: "unranked", label: "Unranked" },
] as const;

const chartConfig = {
  count: { label: "Keywords", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function RankDistributionChart({ id }: { id: string }) {
  const { data: summary } = useSuspenseQuery(appSummaryOptions(id));
  const data = BUCKETS.map((bucket) => ({
    bucket: bucket.label,
    count: summary.rankDistribution[bucket.key],
    muted: bucket.key === "unranked",
  }));

  return (
    <Card>
      <CardHeader>
        <CardDescription>Rank distribution</CardDescription>
        <CardTitle>Where your keywords rank</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[240px] w-full">
          <BarChart
            accessibilityLayer
            data={data}
            layout="vertical"
            margin={{ left: 8, right: 28 }}
          >
            <XAxis type="number" dataKey="count" hide />
            <YAxis
              type="category"
              dataKey="bucket"
              tickLine={false}
              axisLine={false}
              width={64}
            />
            <ChartTooltip content={<ChartTooltipContent hideIndicator />} />
            <Bar dataKey="count" radius={4}>
              {data.map((entry) => (
                <Cell
                  key={entry.bucket}
                  fill="var(--color-count)"
                  fillOpacity={entry.muted ? 0.35 : 1}
                />
              ))}
              <LabelList
                dataKey="count"
                position="right"
                className="fill-foreground"
                fontSize={12}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
