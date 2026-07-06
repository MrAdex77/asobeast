"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { FormEvent } from "react";
import { parseStoreUrl } from "@asobeast/shared";
import { ApiError, importApp } from "@/lib/api";

export function ImportAppForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNote(null);

    try {
      parseStoreUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unrecognized store URL");
      return;
    }

    startTransition(async () => {
      try {
        await importApp(url);
        setUrl("");
        router.refresh();
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.envelope.statusCode === 501) {
            setNote(err.envelope.message);
          } else {
            setError(err.envelope.message);
          }
          return;
        }
        setError("Could not reach the api to import this app");
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://apps.apple.com/us/app/name/id123456789"
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <button
          type="submit"
          disabled={pending || url.trim() === ""}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pending ? "Importing…" : "Import"}
        </button>
      </div>
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      {note ? (
        <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300">
          {note}
        </p>
      ) : null}
    </form>
  );
}
