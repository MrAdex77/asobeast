import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { KeywordsWorkspace } from "@/components/keywords/KeywordsWorkspace";
import { getQueryClient } from "@/lib/get-query-client";
import { keywordsOptions } from "@/lib/queries";
import { sortParser } from "@/lib/search-params";

export default async function KeywordsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sort?: string | string[] }>;
}) {
  const { id } = await params;
  const sort = sortParser.parseServerSide((await searchParams).sort);

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(keywordsOptions(id, sort));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <KeywordsWorkspace id={id} />
    </HydrationBoundary>
  );
}
