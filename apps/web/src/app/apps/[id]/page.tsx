import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { CoverageCard } from "@/components/overview/CoverageCard";
import { MoversCard } from "@/components/overview/MoversCard";
import { RankDistributionChart } from "@/components/overview/RankDistributionChart";
import { StatCards } from "@/components/overview/StatCards";
import { VisibilityChart } from "@/components/overview/VisibilityChart";
import { getQueryClient } from "@/lib/get-query-client";
import { appSummaryOptions, visibilityOptions } from "@/lib/queries";
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
      </div>
    </HydrationBoundary>
  );
}
