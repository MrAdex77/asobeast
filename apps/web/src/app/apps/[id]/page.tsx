import { KEYWORD_SORTS } from "@asobeast/shared";
import type { KeywordSort, TrackedKeywordItem } from "@asobeast/shared";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { EmptyState } from "@/components/EmptyState";
import { KeywordTable } from "@/components/KeywordTable";
import { CoverageCard } from "@/components/overview/CoverageCard";
import { MoversCard } from "@/components/overview/MoversCard";
import { RankDistributionChart } from "@/components/overview/RankDistributionChart";
import { StatCards } from "@/components/overview/StatCards";
import { VisibilityChart } from "@/components/overview/VisibilityChart";
import { getKeywords } from "@/lib/api";
import { getQueryClient } from "@/lib/get-query-client";
import { appSummaryOptions, visibilityOptions } from "@/lib/queries";
import { presetToRange } from "@/lib/ranges";

function parseSort(value: string | string[] | undefined): KeywordSort | undefined {
  return typeof value === "string" &&
    (KEYWORD_SORTS as readonly string[]).includes(value)
    ? (value as KeywordSort)
    : undefined;
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

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(appSummaryOptions(id));
  void queryClient.prefetchQuery(visibilityOptions(id, presetToRange("30d")));
  const keywords = await getKeywords(id, sort).catch(
    () => [] as TrackedKeywordItem[],
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="flex flex-col gap-6">
        <StatCards id={id} />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <VisibilityChart id={id} />
          </div>
          <RankDistributionChart id={id} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <MoversCard id={id} />
          <CoverageCard id={id} />
        </div>

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
    </HydrationBoundary>
  );
}
