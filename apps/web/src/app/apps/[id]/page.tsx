import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { CategoryRankCard } from "@/components/overview/CategoryRankCard";
import { CoverageCard } from "@/components/overview/CoverageCard";
import { MoversCard } from "@/components/overview/MoversCard";
import { RankDistributionChart } from "@/components/overview/RankDistributionChart";
import { RankDistributionHistoryChart } from "@/components/overview/RankDistributionHistoryChart";
import {
  ChartCardSkeleton,
  PanelCardSkeleton,
  StatCardsSkeleton,
} from "@/components/overview/skeletons";
import { StatCards } from "@/components/overview/StatCards";
import { VisibilityChart } from "@/components/overview/VisibilityChart";
import { getQueryClient } from "@/lib/get-query-client";
import {
  appSummaryOptions,
  categoryRanksOptions,
  rankDistributionHistoryOptions,
  visibilityOptions,
} from "@/lib/queries";
import { presetToRange } from "@/lib/ranges";

export default async function AppOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(appSummaryOptions(id));
  void queryClient.prefetchQuery(visibilityOptions(id, presetToRange("30d")));
  void queryClient.prefetchQuery(categoryRanksOptions(id, presetToRange("30d")));
  void queryClient.prefetchQuery(
    rankDistributionHistoryOptions(id, presetToRange("30d")),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="flex flex-col gap-6">
        <Suspense fallback={<StatCardsSkeleton />}>
          <StatCards id={id} />
        </Suspense>

        <div className="grid gap-6 lg:grid-cols-3 [&>*]:min-w-0">
          <div className="lg:col-span-2">
            <VisibilityChart id={id} />
          </div>
          <Suspense fallback={<ChartCardSkeleton />}>
            <RankDistributionChart id={id} />
          </Suspense>
        </div>

        <RankDistributionHistoryChart id={id} />

        <CategoryRankCard id={id} />

        <div className="grid gap-6 lg:grid-cols-2">
          <Suspense fallback={<PanelCardSkeleton />}>
            <MoversCard id={id} />
          </Suspense>
          <Suspense fallback={<PanelCardSkeleton />}>
            <CoverageCard id={id} />
          </Suspense>
        </div>
      </div>
    </HydrationBoundary>
  );
}
