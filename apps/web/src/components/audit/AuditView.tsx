"use client";

import { useState } from "react";
import type {
  AppAuditResult,
  AuditCheckResult,
  AuditCheckStatus,
  AuditFactorResult,
  AuditInputAnswers,
  AuditRecommendation,
} from "@asobeast/shared";
import { AuditInputsForm } from "@/components/AuditInputsForm";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type BadgeVariant = "success" | "warning" | "destructive" | "secondary";

const STATUS_VARIANT: Record<AuditCheckStatus, BadgeVariant> = {
  pass: "success",
  warn: "warning",
  fail: "destructive",
  unanswered: "secondary",
};

const CHECK_TO_ANSWER: Record<string, keyof AuditInputAnswers> = {
  "screenshots-first-three": "screenshotsFirst3Compelling",
  "screenshots-text-overlays": "screenshotsTextOverlays",
  "screenshots-consistent": "screenshotsConsistent",
  "screenshots-localized": "screenshotsLocalized",
  "screenshots-device-frames": "screenshotsDeviceFrames",
  "preview-video-exists": "previewVideoExists",
  "preview-video-hook": "previewVideoHook",
  "preview-video-length": "previewVideoLength",
  "preview-video-sound": "previewVideoWorksWithoutSound",
  "ratings-responses": "reviewResponses",
  "ratings-prompts": "ratingPrompts",
  "icon-distinctive": "iconDistinctive",
  "icon-simple": "iconSimple",
  "icon-category-fit": "iconCategoryFit",
  "icon-no-text": "iconNoText",
  "conversion-promo": "promotionalText",
  "conversion-events": "inAppEvents",
  "conversion-cpp": "customProductPages",
};

function initialAnswers(factors: AuditFactorResult[]): AuditInputAnswers {
  const answers: AuditInputAnswers = {};
  for (const factor of factors) {
    for (const check of factor.checks) {
      const key = CHECK_TO_ANSWER[check.id];
      if (key && check.status !== "unanswered") {
        answers[key] = check.status === "pass";
      }
    }
  }
  return answers;
}

function FactorRow({ factor }: { factor: AuditFactorResult }) {
  const pct = factor.score === null ? 0 : factor.score * 10;
  return (
    <details className="rounded-xl border border-zinc-200 dark:border-zinc-800">
      <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
        <span className="flex items-center gap-2 font-medium">
          {factor.label}
          <span className="text-xs text-zinc-400">weight {factor.weight}</span>
          {factor.needsInput ? (
            <Badge variant="warning">needs input</Badge>
          ) : null}
        </span>
        <span className="flex items-center gap-3">
          <span className="hidden h-2 w-32 overflow-hidden rounded-full bg-zinc-100 sm:block dark:bg-zinc-800">
            <span
              className="block h-full bg-zinc-900 dark:bg-zinc-100"
              style={{ width: `${pct}%` }}
            />
          </span>
          <span className="tabular-nums text-sm">
            {factor.score === null ? "—" : `${factor.score}/10`}
          </span>
        </span>
      </summary>
      <ul className="flex flex-col gap-2 border-t border-zinc-100 px-4 py-3 dark:border-zinc-800/60">
        {factor.checks.map((check: AuditCheckResult) => (
          <li key={check.id} className="flex items-start justify-between gap-3 text-sm">
            <span className="flex flex-col">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                {check.label}
              </span>
              <span className="text-zinc-500 dark:text-zinc-400">
                {check.detail}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <Badge variant="outline">{check.kind}</Badge>
              <Badge variant={STATUS_VARIANT[check.status]}>
                {check.status}
              </Badge>
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function RecommendationList({
  title,
  items,
}: {
  title: string;
  items: AuditRecommendation[];
}) {
  return (
    <Card>
      <CardContent>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
        {items.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Nothing here — great work.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {items.slice(0, 5).map((item) => (
              <li key={`${item.factorId}-${item.checkId}`}>
                <span className="font-medium">{item.label}</span>
                <span className="block text-muted-foreground">
                  {item.detail}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function AuditView({
  appId,
  audit: initialAudit,
}: {
  appId: string;
  audit: AppAuditResult;
}) {
  const [audit, setAudit] = useState(initialAudit);

  return (
    <div className="flex flex-col gap-8">
      <section className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
        <Card className="text-center">
          <CardContent>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              ASO score
            </span>
            <div className="text-4xl font-semibold">
              {audit.overall === null ? "—" : Math.round(audit.overall)}
              <span className="text-lg text-muted-foreground">/100</span>
            </div>
          </CardContent>
        </Card>
        <p className="text-sm text-muted-foreground">
          Automated coverage: {audit.coveredWeight} of {audit.totalWeight}{" "}
          weight scored. Unanswered factors renormalize out of the overall.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Factors</h2>
        {audit.factors.map((factor) => (
          <FactorRow key={factor.id} factor={factor} />
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Recommendations</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <RecommendationList
            title="Quick wins"
            items={audit.recommendations.quickWins}
          />
          <RecommendationList
            title="High impact"
            items={audit.recommendations.highImpact}
          />
          <RecommendationList
            title="Strategic"
            items={audit.recommendations.strategic}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Manual answers</h2>
        <AuditInputsForm
          appId={appId}
          initial={initialAnswers(audit.factors)}
          onSaved={setAudit}
        />
      </section>
    </div>
  );
}
