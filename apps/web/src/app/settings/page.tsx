import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { WebhooksCard } from "@/components/settings/WebhooksCard";
import { WebhooksCardSkeleton } from "@/components/settings/skeletons";
import { getQueryClient } from "@/lib/get-query-client";
import { webhooksOptions } from "@/lib/queries";

export default async function SettingsPage() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(webhooksOptions);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure webhook alerts for metadata and rank changes.
          </p>
        </div>
        <Suspense fallback={<WebhooksCardSkeleton />}>
          <WebhooksCard />
        </Suspense>
      </div>
    </HydrationBoundary>
  );
}
