import Link from "next/link";
import type { KeywordSort, TrackedKeywordItem } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { BucketBadge } from "./BucketBadge";
import { RelevanceCell } from "./RelevanceCell";

const SORT_COLUMNS: { key: KeywordSort; label: string }[] = [
  { key: "position", label: "Position" },
  { key: "traffic", label: "Volume" },
  { key: "difficulty", label: "Difficulty" },
  { key: "opportunity", label: "Opportunity" },
];

function num(value: number | null): string {
  return value === null ? "—" : String(Math.round(value));
}

function difficulty100(value: number | null): string {
  return value === null ? "—" : String(Math.round(value * 10));
}

function Delta({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-zinc-400">—</span>;
  }
  if (value === 0) {
    return <span className="text-zinc-400">■ 0</span>;
  }
  if (value < 0) {
    return (
      <span className="text-emerald-600 dark:text-emerald-400">
        ▲ {Math.abs(value)}
      </span>
    );
  }
  return <span className="text-red-600 dark:text-red-400">▼ {value}</span>;
}

function SortHeader({
  appId,
  column,
  label,
  active,
}: {
  appId: string;
  column: KeywordSort;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={`/apps/${appId}?sort=${column}`}
      className={
        active
          ? "font-semibold text-zinc-900 dark:text-zinc-100"
          : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      }
    >
      {label}
    </Link>
  );
}

export function KeywordTable({
  appId,
  sort,
  keywords,
}: {
  appId: string;
  sort?: KeywordSort;
  keywords: TrackedKeywordItem[];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <tr>
            <th className="px-4 py-3 font-medium">Keyword</th>
            <th className="px-4 py-3 font-medium">Source</th>
            <th className="px-4 py-3 font-medium">Bucket</th>
            {SORT_COLUMNS.map((column) => (
              <th key={column.key} className="px-4 py-3 font-medium">
                <SortHeader
                  appId={appId}
                  column={column.key}
                  label={column.label}
                  active={sort === column.key}
                />
              </th>
            ))}
            <th className="px-4 py-3 font-medium">Relevance</th>
            <th className="px-4 py-3 font-medium">7d</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {keywords.map((keyword) => (
            <tr key={keyword.keywordId}>
              <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">
                {keyword.text}
              </td>
              <td className="px-4 py-3">
                <Badge variant="secondary">
                  {keyword.source.toLowerCase()}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <BucketBadge bucket={keyword.bucket} />
              </td>
              <td className="px-4 py-3 tabular-nums">
                {keyword.latestPosition ?? "—"}
              </td>
              <td className="px-4 py-3 tabular-nums">{num(keyword.volume)}</td>
              <td className="px-4 py-3 tabular-nums">
                {difficulty100(keyword.difficulty)}
              </td>
              <td className="px-4 py-3 tabular-nums">
                {num(keyword.opportunity)}
              </td>
              <td className="px-4 py-3 tabular-nums">
                <RelevanceCell
                  appId={appId}
                  keywordId={keyword.keywordId}
                  relevance={keyword.relevance}
                />
              </td>
              <td className="px-4 py-3 tabular-nums">
                <Delta value={keyword.positionDelta7d} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
