import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/get-query-client";
import { portfolioOptions, recentChangesOptions } from "@/lib/queries";
import { AppsDashboard } from "@/components/apps/AppsDashboard";
import { AppsDashboardSkeleton } from "@/components/apps/skeletons";
import { RecentChangesCard } from "@/components/changes/RecentChangesCard";

export default async function Page() {
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.fetchQuery(portfolioOptions),
    queryClient.fetchQuery(recentChangesOptions()),
  ]);
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="flex flex-col gap-8">
        <Suspense fallback={<AppsDashboardSkeleton />}>
          <AppsDashboard />
        </Suspense>
        <RecentChangesCard />
      </div>
    </HydrationBoundary>
  );
}
