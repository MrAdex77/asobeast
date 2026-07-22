import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { BudgetCard } from "@/components/settings/BudgetCard";
import { DeliveryCard } from "@/components/settings/DeliveryCard";
import { EmailAlertsCard } from "@/components/settings/EmailAlertsCard";
import { WebhooksCard } from "@/components/settings/WebhooksCard";
import {
  BudgetCardSkeleton,
  DeliveryCardSkeleton,
  EmailAlertsCardSkeleton,
  WebhooksCardSkeleton,
} from "@/components/settings/skeletons";
import { getQueryClient } from "@/lib/get-query-client";
import {
  alertDeliveryOptions,
  alertsConfigOptions,
  budgetOptions,
  emailAlertsOptions,
  webhooksOptions,
} from "@/lib/queries";

export default async function SettingsPage() {
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(webhooksOptions),
    queryClient.prefetchQuery(emailAlertsOptions),
    queryClient.prefetchQuery(alertsConfigOptions),
    queryClient.prefetchQuery(alertDeliveryOptions),
    queryClient.prefetchQuery(budgetOptions),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure alert channels and review your daily request budget.
          </p>
        </div>
        <Suspense fallback={<BudgetCardSkeleton />}>
          <BudgetCard />
        </Suspense>
        <Suspense fallback={<DeliveryCardSkeleton />}>
          <DeliveryCard />
        </Suspense>
        <Suspense fallback={<WebhooksCardSkeleton />}>
          <WebhooksCard />
        </Suspense>
        <Suspense fallback={<EmailAlertsCardSkeleton />}>
          <EmailAlertsCard />
        </Suspense>
      </div>
    </HydrationBoundary>
  );
}
