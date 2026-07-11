"use client";

import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import type { ChangeEventItem, ChangeField } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { changesOptions } from "@/lib/queries";
import { formatDate, formatNumber, formatPrice } from "@/lib/format";
import { CHANGE_WINDOWS } from "@/lib/ranges";
import { changeDaysParser } from "@/lib/search-params";
import { ChangeTimelineSkeleton } from "./skeletons";

const FIELD_LABELS: Record<ChangeField, string> = {
  title: "Title",
  subtitle: "Subtitle",
  summary: "Summary",
  description: "Description",
  version: "Version",
  price: "Price",
  screenshots: "Screenshots",
  icon: "Icon",
};

function dayKey(capturedAt: string): string {
  return capturedAt.slice(0, 10);
}

function text(value: string | null): string {
  return value === null || value === "" ? "—" : value;
}

function chars(value: string | null): string {
  return value === null ? "—" : `${formatNumber(Number(value))} chars`;
}

function price(value: string | null): string {
  return value === null ? "—" : formatPrice(Number(value));
}

function count(value: string | null): string {
  return value === null ? "—" : formatNumber(Number(value));
}

function ChangeValue({ event }: { event: ChangeEventItem }) {
  const { field, before, after } = event;

  if (field === "icon") {
    return <span className="text-muted-foreground">Icon updated</span>;
  }

  let from: string;
  let to: string;
  if (field === "summary" || field === "description") {
    from = chars(before);
    to = chars(after);
  } else if (field === "price") {
    from = price(before);
    to = price(after);
  } else if (field === "screenshots") {
    from = count(before);
    to = count(after);
  } else {
    from = text(before);
    to = text(after);
  }

  return (
    <span className="break-words">
      <span className="text-muted-foreground line-through">{from}</span>
      <span className="mx-1.5 text-muted-foreground">→</span>
      <span className="font-medium">{to}</span>
    </span>
  );
}

function ChangeRow({ event }: { event: ChangeEventItem }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <AppIcon src={null} name={event.appName} size={32} />
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">
            {event.appName ?? "Unknown app"}
          </span>
          {event.isCompetitor ? (
            <Badge variant="secondary">Competitor</Badge>
          ) : null}
          <Badge variant="outline">{FIELD_LABELS[event.field]}</Badge>
        </div>
        <p className="text-sm">
          <ChangeValue event={event} />
        </p>
      </div>
    </div>
  );
}

function ChangeList({ id, days }: { id: string; days: number }) {
  const { data } = useSuspenseQuery(changesOptions(id, days));

  if (data.events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        No changes captured yet — changes appear after the next daily refresh.
      </div>
    );
  }

  const groups = new Map<string, ChangeEventItem[]>();
  for (const event of data.events) {
    const key = dayKey(event.capturedAt);
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(event);
    } else {
      groups.set(key, [event]);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {Array.from(groups.entries()).map(([day, events]) => (
        <section key={day} className="flex flex-col gap-1">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {formatDate(day)}
          </h3>
          <div className="divide-y">
            {events.map((event) => (
              <ChangeRow key={event.id} event={event} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function ChangeTimeline({ id }: { id: string }) {
  const [days, setDays] = useQueryState("days", changeDaysParser);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardDescription>Changes</CardDescription>
          <CardTitle>Metadata change timeline</CardTitle>
        </div>
        <Tabs
          value={String(days)}
          onValueChange={(next) => void setDays(Number(next) as typeof days)}
        >
          <TabsList>
            {CHANGE_WINDOWS.map((window) => (
              <TabsTrigger key={window} value={String(window)}>
                {window}d
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<ChangeTimelineSkeleton />}>
          <ChangeList id={id} days={days} />
        </Suspense>
      </CardContent>
    </Card>
  );
}
