import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { BudgetCard } from "@/components/settings/BudgetCard";
import { WebhooksCard } from "@/components/settings/WebhooksCard";
import {
  BudgetCardSkeleton,
  WebhooksCardSkeleton,
} from "@/components/settings/skeletons";
import { getQueryClient } from "@/lib/get-query-client";
import { budgetOptions, webhooksOptions } from "@/lib/queries";

export default async function SettingsPage() {
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(webhooksOptions),
    queryClient.prefetchQuery(budgetOptions),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure webhook alerts and review your daily request budget.
          </p>
        </div>
        <Suspense fallback={<BudgetCardSkeleton />}>
          <BudgetCard />
        </Suspense>
        <Suspense fallback={<WebhooksCardSkeleton />}>
          <WebhooksCard />
        </Suspense>
      </div>
    </HydrationBoundary>
  );
}
