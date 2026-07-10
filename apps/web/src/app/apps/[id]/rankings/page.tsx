import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { RankingsView } from "@/components/rankings/RankingsView";
import { getQueryClient } from "@/lib/get-query-client";
import { keywordsOptions, rankingsOptions } from "@/lib/queries";
import { presetToRange } from "@/lib/ranges";
import { rangeParser } from "@/lib/search-params";

export default async function RankingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string | string[] }>;
}) {
  const { id } = await params;
  const range = rangeParser.parseServerSide((await searchParams).range);

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(keywordsOptions(id));
  void queryClient.prefetchQuery(rankingsOptions(id, presetToRange(range)));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <RankingsView id={id} />
    </HydrationBoundary>
  );
}
