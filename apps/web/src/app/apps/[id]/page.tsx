import { notFound } from "next/navigation";
import { KEYWORD_SORTS } from "@asobeast/shared";
import type { KeywordSort, TrackedKeywordItem } from "@asobeast/shared";
import { AppActions } from "@/components/AppActions";
import { AppIcon } from "@/components/AppIcon";
import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { KeywordTable } from "@/components/KeywordTable";
import { Stat } from "@/components/Stat";
import { getApp, getKeywords, getSummary } from "@/lib/api";

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

export default async function AppDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sort?: string | string[] }>;
}) {
  const { id } = await params;
  const sort = parseSort((await searchParams).sort);

  const detail = await getApp(id).catch(() => null);
  if (!detail) notFound();

  const [summary, keywords] = await Promise.all([
    getSummary(id).catch(() => null),
    getKeywords(id, sort).catch(() => [] as TrackedKeywordItem[]),
  ]);

  const storeLabel = detail.store === "APP_STORE" ? "App Store" : "Google Play";

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <AppIcon src={detail.iconUrl} name={detail.name} size={64} />
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {detail.name ?? "Untitled app"}
            </h1>
            <Badge tone="info">{storeLabel}</Badge>
          </div>
        </div>
        <AppActions appId={detail.id} />
      </header>

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
          <KeywordTable appId={detail.id} sort={sort} keywords={keywords} />
        )}
      </section>

      <section>
        <Card className="border-dashed">
          <div className="flex flex-col gap-1">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              History charts coming soon
            </span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              Ranking and visibility trends will render here (Recharts over
              RankingSeries and VisibilityHistory).
            </span>
          </div>
        </Card>
      </section>
    </div>
  );
}
