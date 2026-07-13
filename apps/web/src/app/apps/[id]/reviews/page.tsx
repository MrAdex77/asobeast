import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { RatingsChart } from "@/components/reviews/RatingsChart";
import { ReviewsList } from "@/components/reviews/ReviewsList";
import { getQueryClient } from "@/lib/get-query-client";
import { presetToRange } from "@/lib/ranges";
import { ratingsHistoryOptions, reviewsOptions } from "@/lib/queries";

export default async function ReviewsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(reviewsOptions(id, {})),
    queryClient.prefetchQuery(
      ratingsHistoryOptions(id, presetToRange("30d")),
    ),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="flex flex-col gap-6">
        <RatingsChart id={id} />
        <ReviewsList id={id} />
      </div>
    </HydrationBoundary>
  );
}
