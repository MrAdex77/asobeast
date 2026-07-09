import { KEYWORD_SORTS } from "@asobeast/shared";
import type { KeywordSort, TrackedKeywordItem } from "@asobeast/shared";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { KeywordTable } from "@/components/KeywordTable";
import { Stat } from "@/components/Stat";
import { getKeywords, getSummary } from "@/lib/api";

function parseSort(value: string | string[] | undefined): KeywordSort | undefined {
  return typeof value === "string" &&
    (KEYWORD_SORTS as readonly string[]).includes(value)
    ? (value as KeywordSort)
    : undefined;
}

function signed(value: number | null): string {
  if (value === null) return "no 7d data";
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded} vs 7d ago`;
}

export default async function AppOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sort?: string | string[] }>;
}) {
  const { id } = await params;
  const sort = parseSort((await searchParams).sort);

  const [summary, keywords] = await Promise.all([
    getSummary(id).catch(() => null),
    getKeywords(id, sort).catch(() => [] as TrackedKeywordItem[]),
  ]);

  return (
    <div className="flex flex-col gap-8">
      {summary ? (
        <section className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Visibility"
              value={Math.round(summary.visibility.current)}
              hint={signed(summary.visibility.delta7d)}
            />
            <Stat label="Tracked keywords" value={summary.trackedKeywords} />
            <Stat label="Competitors" value={summary.competitors} />
            <Stat
              label="Last refresh"
              value={
                summary.lastRefreshAt
                  ? summary.lastRefreshAt.slice(0, 10)
                  : "never"
              }
            />
          </div>
          <Card>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <span className="text-xs uppercase tracking-wide text-zinc-400">
                Rank distribution
              </span>
              <span>Top 1: {summary.rankDistribution.top1}</span>
              <span>Top 3: {summary.rankDistribution.top3}</span>
              <span>Top 10: {summary.rankDistribution.top10}</span>
              <span>Top 50: {summary.rankDistribution.top50}</span>
              <span>Beyond: {summary.rankDistribution.beyond}</span>
              <span>Unranked: {summary.rankDistribution.unranked}</span>
            </div>
          </Card>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Keywords</h2>
        {keywords.length === 0 ? (
          <EmptyState
            title="No tracked keywords"
            description="Run the daily pipeline or add keywords to start tracking rankings."
          />
        ) : (
          <KeywordTable appId={id} sort={sort} keywords={keywords} />
        )}
      </section>
    </div>
  );
}
