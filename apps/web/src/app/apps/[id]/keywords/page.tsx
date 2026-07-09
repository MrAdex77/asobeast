import { KEYWORD_SORTS } from "@asobeast/shared";
import type { KeywordSort, TrackedKeywordItem } from "@asobeast/shared";
import { KeywordTable } from "@/components/KeywordTable";
import { getKeywords } from "@/lib/api";

function parseSort(value: string | string[] | undefined): KeywordSort | undefined {
  return typeof value === "string" &&
    (KEYWORD_SORTS as readonly string[]).includes(value)
    ? (value as KeywordSort)
    : undefined;
}

export default async function KeywordsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sort?: string | string[] }>;
}) {
  const { id } = await params;
  const sort = parseSort((await searchParams).sort);
  const keywords = await getKeywords(id, sort).catch(
    () => [] as TrackedKeywordItem[],
  );

  if (keywords.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        No tracked keywords yet. Run the daily pipeline or add keywords to start
        tracking rankings.
      </div>
    );
  }

  return <KeywordTable appId={id} sort={sort} keywords={keywords} />;
}
