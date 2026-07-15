"use client";

import { useState } from "react";
import {
  type LintIssue,
  type LintSeverity,
  type MetadataField,
} from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";

const SEVERITY_VARIANT: Record<
  LintSeverity,
  "destructive" | "warning" | "info"
> = {
  error: "destructive",
  warn: "warning",
  info: "info",
};

const FIELD_LABELS: Record<MetadataField, string> = {
  title: "Title",
  subtitle: "Subtitle",
  keywordField: "Keyword field",
  description: "Description",
  promotionalText: "Promotional text",
  whatsNew: "What's New",
  shortDescription: "Short description",
};

export function MetadataFieldCard({
  field,
  value,
  limit,
  issues,
}: {
  field: MetadataField;
  value: string;
  limit: number;
  issues: LintIssue[];
}) {
  const [draft, setDraft] = useState(value);
  const over = draft.length > limit;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">
          {FIELD_LABELS[field]}
        </span>
        <span
          className={
            over
              ? "text-sm font-semibold tabular-nums text-red-600 dark:text-red-400"
              : "text-sm tabular-nums text-zinc-500 dark:text-zinc-400"
          }
        >
          {draft.length}/{limit}
        </span>
      </div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={field === "description" ? 4 : 2}
        className="mt-2 w-full resize-y rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
      />
      {issues.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1.5">
          {issues.map((issue, index) => (
            <li
              key={`${issue.rule}-${index}`}
              className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400"
            >
              <Badge variant={SEVERITY_VARIANT[issue.severity]}>
                {issue.rule}
              </Badge>
              {issue.message}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">
          No issues.
        </p>
      )}
    </div>
  );
}
