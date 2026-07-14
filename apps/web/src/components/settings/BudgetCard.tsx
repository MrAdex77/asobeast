"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatNumber } from "@/lib/format";
import { budgetOptions } from "@/lib/queries";

const WARN = 0.6;
const DANGER = 0.85;
const WARNING_COPY =
  "Daily jobs may not finish within store rate limits; remove keywords or countries, or raise SCRAPE_ITUNES_RPM at your own risk.";

export function BudgetCard() {
  const { data: budget } = useSuspenseQuery(budgetOptions);
  const pct = Math.round(budget.utilization * 100);
  const level =
    budget.utilization > DANGER
      ? "danger"
      : budget.utilization > WARN
        ? "warn"
        : "ok";
  const barColor =
    level === "danger"
      ? "bg-destructive"
      : level === "warn"
        ? "bg-amber-500"
        : "bg-primary";
  const status =
    level === "danger" ? "Over capacity" : level === "warn" ? "High" : "Healthy";

  const rows = [
    { label: "Apps", value: budget.apps },
    { label: "Keywords", value: budget.keywords },
    { label: "Categories", value: budget.categories },
    { label: "Reviews", value: budget.reviews },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily request budget</CardTitle>
        <CardDescription>
          Estimated store requests the daily pipeline enqueues, against your
          rate limit.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          {rows.map((row) => (
            <div key={row.label} className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {formatNumber(row.value)}
              </dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">
              {formatNumber(budget.total)} of{" "}
              {formatNumber(budget.capacityPerDay)} requests/day
            </span>
            <span className="font-medium tabular-nums">
              {status} · {pct}%
            </span>
          </div>
          <div
            role="meter"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Daily request utilization"
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
          >
            <div
              className={`h-full ${barColor}`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
        </div>

        {level !== "ok" ? (
          <Alert variant={level === "danger" ? "destructive" : "default"}>
            <TriangleAlert />
            <AlertDescription>{WARNING_COPY}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
