import { Line, LineChart } from "recharts";
import type { VisibilityPoint } from "@asobeast/shared";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";

const chartConfig = {
  visibility: { label: "Visibility", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function Sparkline({ points }: { points: VisibilityPoint[] }) {
  if (points.length < 2) {
    return (
      <div className="flex h-10 items-center text-xs text-muted-foreground">
        Not enough history yet
      </div>
    );
  }

  return (
    <ChartContainer
      config={chartConfig}
      className="h-10 w-full"
      role="img"
      aria-label="visibility, last 30 days"
    >
      <LineChart
        accessibilityLayer
        data={points}
        margin={{ top: 4, right: 0, bottom: 4, left: 0 }}
      >
        <Line
          dataKey="visibility"
          type="monotone"
          stroke="var(--color-visibility)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
