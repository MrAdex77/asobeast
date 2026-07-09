"use client";

import { useState } from "react";
import type { KeywordFieldSuggestion } from "@asobeast/shared";
import { Card, CardContent } from "@/components/ui/card";

export function KeywordFieldSuggestionCard({
  suggestion,
}: {
  suggestion: KeywordFieldSuggestion;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(suggestion.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Suggested keyword field
        </span>
        <span className="text-sm tabular-nums text-zinc-500 dark:text-zinc-400">
          {suggestion.charactersUsed}/{suggestion.charactersLimit}
        </span>
      </div>
      {suggestion.value.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Every tracked keyword is already covered.
        </p>
      ) : (
        <>
          <p className="mt-2 break-words rounded-lg bg-zinc-50 p-2 font-mono text-sm text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
            {suggestion.value}
          </p>
          <button
            type="button"
            onClick={copy}
            className="mt-3 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </>
      )}
      </CardContent>
    </Card>
  );
}
