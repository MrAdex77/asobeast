import { notFound } from "next/navigation";
import type { KeywordCoverageRow } from "@asobeast/shared";
import { BucketBadge } from "@/components/BucketBadge";
import { KeywordFieldSuggestionCard } from "@/components/KeywordFieldSuggestionCard";
import { MetadataFieldCard } from "@/components/MetadataFieldCard";
import { ApiError, getMetadataAudit } from "@/lib/api";

function Tick({ on }: { on: boolean }) {
  return on ? (
    <span className="text-emerald-600 dark:text-emerald-400">✓</span>
  ) : (
    <span className="text-zinc-300 dark:text-zinc-600">—</span>
  );
}

function CoverageTable({ rows }: { rows: KeywordCoverageRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <tr>
            <th className="px-4 py-3 font-medium">Keyword</th>
            <th className="px-4 py-3 font-medium">Bucket</th>
            <th className="px-4 py-3 font-medium">Title</th>
            <th className="px-4 py-3 font-medium">Subtitle</th>
            <th className="px-4 py-3 font-medium">Keyword field</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {rows.map((row) => (
            <tr
              key={row.keywordId}
              className={
                row.uncovered ? "bg-amber-50/60 dark:bg-amber-950/20" : undefined
              }
            >
              <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">
                {row.text}
              </td>
              <td className="px-4 py-3">
                <BucketBadge bucket={row.bucket} />
              </td>
              <td className="px-4 py-3">
                <Tick on={row.inTitle} />
              </td>
              <td className="px-4 py-3">
                <Tick on={row.inSubtitle} />
              </td>
              <td className="px-4 py-3">
                <Tick on={row.inKeywordField} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function MetadataPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getMetadataAudit(id).catch((err) => {
    if (err instanceof ApiError && err.envelope.statusCode === 404) notFound();
    return null;
  });
  if (!result) {
    return (
      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        Metadata audit is not available for this app yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="grid gap-4 md:grid-cols-2">
        {result.fields.map((field) => (
          <MetadataFieldCard
            key={field.field}
            field={field.field}
            value={field.value ?? ""}
            issues={field.issues}
          />
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Keyword coverage</h2>
        {result.coverage.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Track keywords to see how your metadata covers them.
          </div>
        ) : (
          <CoverageTable rows={result.coverage} />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Suggestion</h2>
        <KeywordFieldSuggestionCard suggestion={result.keywordFieldSuggestion} />
      </section>
    </div>
  );
}
