"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ApiError, refreshApp, runDaily } from "@/lib/api";

const buttonClass =
  "rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";

export function AppActions({ appId }: { appId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const [running, startRun] = useTransition();

  function refresh() {
    setMessage(null);
    startRefresh(async () => {
      try {
        const diff = await refreshApp(appId);
        setMessage(
          diff.changes.length > 0
            ? `Refreshed · ${diff.changes.length} change(s)`
            : "Refreshed · no changes",
        );
        router.refresh();
      } catch (err) {
        setMessage(err instanceof ApiError ? err.envelope.message : "Refresh failed");
      }
    });
  }

  function run() {
    setMessage(null);
    startRun(async () => {
      try {
        await runDaily(appId);
        setMessage("Daily pipeline enqueued");
      } catch (err) {
        setMessage(err instanceof ApiError ? err.envelope.message : "Run failed");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className={buttonClass}
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
        <button
          type="button"
          onClick={run}
          disabled={running}
          className={buttonClass}
        >
          {running ? "Running…" : "Run daily"}
        </button>
      </div>
      {message ? (
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{message}</span>
      ) : null}
    </div>
  );
}
