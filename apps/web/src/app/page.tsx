import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/get-query-client";
import { appsListOptions } from "@/lib/queries";
import { AppsDashboard } from "@/components/apps/AppsDashboard";

export default function Page() {
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(appsListOptions);
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AppsDashboard />
    </HydrationBoundary>
  );
}
