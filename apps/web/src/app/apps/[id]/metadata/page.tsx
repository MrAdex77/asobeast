import { notFound } from "next/navigation";
import type { KeywordCoverageRow, MetadataField } from "@asobeast/shared";
import { BucketBadge } from "@/components/BucketBadge";
import { KeywordFieldSuggestionCard } from "@/components/KeywordFieldSuggestionCard";
import { MetadataAssistantPanel } from "@/components/metadata/MetadataAssistantPanel";
import { MetadataFieldCard } from "@/components/MetadataFieldCard";
import {
  ApiError,
  getMetadataAssistantStatus,
  getMetadataAudit,
} from "@/lib/api";

const FIELD_ORDER: MetadataField[] = [
  "title",
  "subtitle",
  "shortDescription",
  "keywordField",
  "description",
];

const FIELD_LABELS: Record<MetadataField, string> = {
  title: "Title",
  subtitle: "Subtitle",
  keywordField: "Keyword field",
  description: "Description",
  promotionalText: "Promotional text",
  whatsNew: "What's New",
  shortDescription: "Short description",
};

function Tick({ on }: { on: boolean }) {
  return on ? (
    <span className="text-emerald-600 dark:text-emerald-400">✓</span>
  ) : (
    <span className="text-zinc-300 dark:text-zinc-600">—</span>
  );
}

function CoverageTable({ rows }: { rows: KeywordCoverageRow[] }) {
  const present = new Set(
    rows.flatMap((row) => row.fields.map((field) => field.field)),
  );
  const columns = FIELD_ORDER.filter((field) => present.has(field));

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">
          Keyword coverage across {columns.map((c) => FIELD_LABELS[c]).join(", ")}
          , with uncovered keywords highlighted.
        </caption>
        <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <tr>
            <th className="px-4 py-3 font-medium">Keyword</th>
            <th className="px-4 py-3 font-medium">Bucket</th>
            {columns.map((column) => (
              <th key={column} className="px-4 py-3 font-medium">
                {FIELD_LABELS[column]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {rows.map((row) => {
            const covered = new Map(
              row.fields.map((field) => [field.field, field.covered]),
            );
            return (
              <tr
                key={row.keywordId}
                className={
                  row.uncovered
                    ? "bg-amber-50/60 dark:bg-amber-950/20"
                    : undefined
                }
              >
                <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">
                  {row.text}
                </td>
                <td className="px-4 py-3">
                  <BucketBadge bucket={row.bucket} />
                </td>
                {columns.map((column) => (
                  <td key={column} className="px-4 py-3">
                    <Tick on={covered.get(column) ?? false} />
                  </td>
                ))}
              </tr>
            );
          })}
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
  const assistant = await getMetadataAssistantStatus().catch(() => null);
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
            limit={field.limit}
            issues={field.issues}
          />
        ))}
      </section>

      {assistant?.configured ? (
        <MetadataAssistantPanel appId={id} store={result.store} />
      ) : null}

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

      {result.store === "APP_STORE" && result.keywordFieldSuggestion !== null ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Suggestion</h2>
          <KeywordFieldSuggestionCard
            suggestion={result.keywordFieldSuggestion}
          />
        </section>
      ) : null}
    </div>
  );
}
