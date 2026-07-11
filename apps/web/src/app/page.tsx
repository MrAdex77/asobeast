import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/get-query-client";
import { appsListOptions } from "@/lib/queries";
import { AppsDashboard } from "@/components/apps/AppsDashboard";
import { AppsDashboardSkeleton } from "@/components/apps/skeletons";

export default async function Page() {
  const queryClient = getQueryClient();
  await queryClient.fetchQuery(appsListOptions);
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<AppsDashboardSkeleton />}>
        <AppsDashboard />
      </Suspense>
    </HydrationBoundary>
  );
}
