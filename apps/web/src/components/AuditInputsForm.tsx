"use client";

import { useState, useTransition } from "react";
import type { AppAuditResult, AuditInputAnswers } from "@asobeast/shared";
import { ApiError, saveAuditInputs } from "@/lib/api";

const QUESTIONS: { key: keyof AuditInputAnswers; label: string; group: string }[] =
  [
    { group: "Screenshots", key: "screenshotsFirst3Compelling", label: "First three most compelling" },
    { group: "Screenshots", key: "screenshotsTextOverlays", label: "Benefit-driven captions" },
    { group: "Screenshots", key: "screenshotsConsistent", label: "Consistent design" },
    { group: "Screenshots", key: "screenshotsLocalized", label: "Localized" },
    { group: "Screenshots", key: "screenshotsDeviceFrames", label: "Modern device frames" },
    { group: "Preview video", key: "previewVideoExists", label: "Preview video exists" },
    { group: "Preview video", key: "previewVideoHook", label: "Hook in first 3 seconds" },
    { group: "Preview video", key: "previewVideoLength", label: "15 to 30 seconds" },
    { group: "Preview video", key: "previewVideoWorksWithoutSound", label: "Works without sound" },
    { group: "Ratings", key: "reviewResponses", label: "Responds to reviews" },
    { group: "Ratings", key: "ratingPrompts", label: "Strategic rating prompts" },
    { group: "Icon", key: "iconDistinctive", label: "Distinctive" },
    { group: "Icon", key: "iconSimple", label: "Simple at small sizes" },
    { group: "Icon", key: "iconCategoryFit", label: "Category fit" },
    { group: "Icon", key: "iconNoText", label: "No text" },
    { group: "Conversion", key: "promotionalText", label: "Promotional text" },
    { group: "Conversion", key: "inAppEvents", label: "In-app events" },
    { group: "Conversion", key: "customProductPages", label: "Custom product pages" },
  ];

const GROUPS = [...new Set(QUESTIONS.map((q) => q.group))];

export function AuditInputsForm({
  appId,
  initial,
  onSaved,
}: {
  appId: string;
  initial: AuditInputAnswers;
  onSaved: (result: AppAuditResult) => void;
}) {
  const [answers, setAnswers] = useState<AuditInputAnswers>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  function toggle(key: keyof AuditInputAnswers, value: boolean) {
    setAnswers((current) => ({ ...current, [key]: value }));
  }

  function save() {
    setMessage(null);
    startSave(async () => {
      try {
        const result = await saveAuditInputs(appId, answers);
        setMessage("Saved");
        onSaved(result);
      } catch (err) {
        setMessage(err instanceof ApiError ? err.envelope.message : "Save failed");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {GROUPS.map((group) => (
          <div
            key={group}
            className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              {group}
            </span>
            <div className="mt-2 flex flex-col gap-1.5">
              {QUESTIONS.filter((q) => q.group === group).map((q) => (
                <label
                  key={q.key}
                  className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300"
                >
                  <input
                    type="checkbox"
                    checked={answers[q.key] ?? false}
                    onChange={(e) => toggle(q.key, e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
                  />
                  {q.label}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {saving ? "Saving…" : "Save answers"}
        </button>
        {message ? (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {message}
          </span>
        ) : null}
      </div>
    </div>
  );
}
