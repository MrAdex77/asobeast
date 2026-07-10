"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
} from "@/components/ui/chart";
import { formatDayMonth, formatPosition } from "@/lib/format";
import type { RankingChartData } from "./pivot";

const Y_TICKS = [1, 10, 25, 50, 100];

function RankingTooltip({
  active,
  label,
  data,
}: {
  active?: boolean;
  label?: string | number;
  data: RankingChartData;
}) {
  if (!active || label === undefined) return null;

  const row = data.rows.find((candidate) => candidate.date === label);
  if (!row) return null;

  const items = data.keywordIds
    .map((keywordId) => {
      const value = row[keywordId];
      return { keywordId, position: typeof value === "number" ? value : null };
    })
    .sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity));

  return (
    <div className="grid min-w-40 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{formatDayMonth(String(label))}</div>
      <div className="grid gap-1.5">
        {items.map((item) => (
          <div
            key={item.keywordId}
            className="flex items-center justify-between gap-4"
          >
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="size-2 shrink-0 rounded-[2px]"
                style={{ backgroundColor: data.config[item.keywordId]?.color }}
              />
              {data.config[item.keywordId]?.label ?? item.keywordId}
            </span>
            <span className="font-mono font-medium tabular-nums text-foreground">
              {formatPosition(item.position)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RankingChart({ data }: { data: RankingChartData }) {
  return (
    <ChartContainer config={data.config} className="h-[360px] w-full">
      <LineChart
        accessibilityLayer
        data={data.rows}
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
          domain={[1, 100]}
          ticks={Y_TICKS}
          width={36}
          tickLine={false}
          axisLine={false}
          allowDataOverflow
        />
        <ChartTooltip content={<RankingTooltip data={data} />} />
        <ChartLegend content={<ChartLegendContent />} />
        {data.keywordIds.map((keywordId) => (
          <Line
            key={keywordId}
            dataKey={keywordId}
            type="monotone"
            stroke={`var(--color-${keywordId})`}
            strokeWidth={2}
            connectNulls={false}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}
