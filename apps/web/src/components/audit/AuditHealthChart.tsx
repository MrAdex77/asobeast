"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import type { AuditScorePoint } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatDayMonth } from "@/lib/format";
import { auditHistoryOptions } from "@/lib/queries";

const chartConfig = {
  overall: { label: "ASO score", color: "var(--chart-1)" },
} satisfies ChartConfig;

const DELTA_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function scored(points: AuditScorePoint[]): AuditScorePoint[] {
  return points.filter((point) => point.overall !== null);
}

function computeDelta(points: AuditScorePoint[]): number | null {
  const withScore = scored(points);
  if (withScore.length === 0) return null;
  const current = withScore[withScore.length - 1];
  const target = new Date(current.date).getTime() - DELTA_WINDOW_DAYS * DAY_MS;
  const baseline = [...withScore]
    .reverse()
    .find((point) => new Date(point.date).getTime() <= target);
  if (!baseline || baseline === current) return null;
  return (current.overall as number) - (baseline.overall as number);
}

function DeltaChip({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  const rounded = Math.round(delta);
  const variant =
    rounded > 0 ? "success" : rounded < 0 ? "destructive" : "secondary";
  const sign = rounded > 0 ? "+" : "";
  return (
    <Badge variant={variant}>
      {sign}
      {rounded} vs 7d
    </Badge>
  );
}

export function AuditHealthChart({ id }: { id: string }) {
  const { data } = useSuspenseQuery(auditHistoryOptions(id));
  const enough = scored(data.points).length >= 2;

  return (
    <Card>
      <CardHeader>
        <CardDescription>ASO health</CardDescription>
        <CardTitle>Audit score over time</CardTitle>
        <CardAction>
          <DeltaChip delta={computeDelta(data.points)} />
        </CardAction>
      </CardHeader>
      <CardContent>
        {enough ? (
          <ChartContainer config={chartConfig} className="h-[240px] w-full">
            <LineChart
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
              <YAxis
                width={32}
                domain={[0, 100]}
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
                dataKey="overall"
                type="monotone"
                stroke="var(--color-overall)"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
              />
            </LineChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[240px] items-center justify-center text-center text-sm text-muted-foreground">
            Not enough history yet — the daily audit snapshot builds this trend.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
