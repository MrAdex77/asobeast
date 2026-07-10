import type { RankingSeriesItem } from "@asobeast/shared";
import type { ChartConfig } from "@/components/ui/chart";

export const MAX_SERIES = 8;
const PALETTE_SIZE = 5;

export interface RankingChartData {
  rows: Array<Record<string, string | number | null>>;
  config: ChartConfig;
  keywordIds: string[];
  totalSeries: number;
}

export function buildRankingChart(
  series: RankingSeriesItem[],
): RankingChartData {
  const shown = series.slice(0, MAX_SERIES);

  const dates = new Set<string>();
  for (const item of shown) {
    for (const point of item.points) dates.add(point.date);
  }
  const sortedDates = [...dates].sort();

  const config: ChartConfig = {};
  shown.forEach((item, index) => {
    config[item.keywordId] = {
      label: item.text,
      color: `var(--chart-${(index % PALETTE_SIZE) + 1})`,
    };
  });

  const rows = sortedDates.map((date) => {
    const row: Record<string, string | number | null> = { date };
    for (const item of shown) {
      const point = item.points.find((candidate) => candidate.date === date);
      row[item.keywordId] = point ? point.position : null;
    }
    return row;
  });

  return {
    rows,
    config,
    keywordIds: shown.map((item) => item.keywordId),
    totalSeries: series.length,
  };
}
