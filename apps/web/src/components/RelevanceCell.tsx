"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ApiError, updateKeyword } from "@/lib/api";

export function RelevanceCell({
  appId,
  keywordId,
  relevance,
}: {
  appId: string;
  keywordId: string;
  relevance: number | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(relevance === null ? "" : String(relevance));
  const [saving, startSave] = useTransition();

  function commit() {
    setEditing(false);
    const trimmed = value.trim();
    const next = trimmed === "" ? null : Number(trimmed);
    if (next === relevance) return;
    if (next !== null && (!Number.isInteger(next) || next < 1 || next > 100)) {
      setValue(relevance === null ? "" : String(relevance));
      return;
    }
    startSave(async () => {
      try {
        await updateKeyword(appId, keywordId, { relevance: next });
        router.refresh();
      } catch (err) {
        if (err instanceof ApiError) {
          setValue(relevance === null ? "" : String(relevance));
        }
      }
    });
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        min={1}
        max={100}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        className="w-16 rounded border border-zinc-300 bg-white px-1 py-0.5 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-950"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      disabled={saving}
      className="tabular-nums text-zinc-700 underline decoration-dotted underline-offset-2 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-300 dark:hover:text-zinc-100"
    >
      {saving ? "…" : (relevance ?? "—")}
    </button>
  );
}
