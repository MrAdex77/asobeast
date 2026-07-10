import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { CompetitorsView } from "@/components/competitors/CompetitorsView";
import { getQueryClient } from "@/lib/get-query-client";
import { comparisonOptions, competitorsOptions } from "@/lib/queries";

export default async function CompetitorsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(competitorsOptions(id)),
    queryClient.prefetchQuery(comparisonOptions(id, false)),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CompetitorsView id={id} />
    </HydrationBoundary>
  );
}
