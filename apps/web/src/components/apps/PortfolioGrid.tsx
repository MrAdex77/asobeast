import Link from "next/link";
import { Link2 } from "lucide-react";
import type { PortfolioApp, Store } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { TrendChip } from "@/components/overview/TrendChip";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  formatCountry,
  formatDate,
  formatNumber,
  storeLabel,
} from "@/lib/format";
import { DeleteAppMenu } from "./DeleteAppMenu";
import { Sparkline } from "./Sparkline";

const STORE_ORDER: Record<Store, number> = {
  APP_STORE: 0,
  GOOGLE_PLAY: 1,
};

type PortfolioRow =
  | { kind: "app"; app: PortfolioApp }
  | { kind: "group"; id: string; name: string; members: PortfolioApp[] };

function toRows(apps: PortfolioApp[]): PortfolioRow[] {
  const rows: PortfolioRow[] = [];
  const groupRowIndex = new Map<string, number>();

  for (const app of apps) {
    if (app.groupId === null) {
      rows.push({ kind: "app", app });
      continue;
    }

    const existing = groupRowIndex.get(app.groupId);
    if (existing === undefined) {
      groupRowIndex.set(app.groupId, rows.length);
      rows.push({
        kind: "group",
        id: app.groupId,
        name: app.groupName ?? app.name ?? "App group",
        members: [app],
      });
    } else {
      (rows[existing] as { members: PortfolioApp[] }).members.push(app);
    }
  }

  return rows;
}

function AppStats({ app }: { app: PortfolioApp }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span>{formatNumber(app.trackedKeywords)} keywords</span>
      <span>{formatNumber(app.competitors)} competitors</span>
      <span>Updated {formatDate(app.lastCapturedAt)}</span>
    </div>
  );
}

function AppBadges({ app }: { app: PortfolioApp }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant="secondary" className="w-fit">
        {storeLabel(app.store)}
      </Badge>
      <Badge
        variant="outline"
        className="w-fit"
        title={`Home storefront · ${formatCountry(app.country)}`}
      >
        {app.country.toUpperCase()}
      </Badge>
    </div>
  );
}

function PortfolioCard({ app }: { app: PortfolioApp }) {
  const name = app.name ?? "Untitled app";

  return (
    <Card className="relative gap-0 p-4 transition-colors hover:bg-muted/40">
      <Link
        href={`/apps/${app.id}`}
        className="absolute inset-0 z-10 rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <span className="sr-only">{name}</span>
      </Link>

      <div className="absolute top-2 right-2 z-20">
        <DeleteAppMenu id={app.id} name={name} />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-4">
          <AppIcon src={app.iconUrl} name={app.name} />
          <div className="flex min-w-0 flex-1 flex-col gap-1 pr-6">
            <span className="truncate font-medium">{name}</span>
            <AppBadges app={app} />
          </div>
        </div>

        <div className="flex items-end justify-between gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-3xl font-semibold tabular-nums">
              {Math.round(app.visibility.current)}
            </span>
            <TrendChip label="7d" value={app.visibility.delta7d} />
          </div>
        </div>

        <Sparkline points={app.sparkline} />

        <AppStats app={app} />
      </div>
    </Card>
  );
}

function PortfolioGroupMember({ app }: { app: PortfolioApp }) {
  const name = app.name ?? "Untitled app";

  return (
    <div className="relative flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
      <Link
        href={`/apps/${app.id}`}
        className="absolute inset-0 z-10 rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <span className="sr-only">{name}</span>
      </Link>

      <div className="absolute top-2 right-0 z-20">
        <DeleteAppMenu id={app.id} name={name} />
      </div>

      <div className="flex items-center gap-3 pr-6">
        <AppIcon src={app.iconUrl} name={app.name} size={36} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-sm font-medium">{name}</span>
          <AppBadges app={app} />
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-2xl font-semibold tabular-nums">
            {Math.round(app.visibility.current)}
          </span>
          <TrendChip label="7d" value={app.visibility.delta7d} />
        </div>
      </div>

      <Sparkline points={app.sparkline} />

      <AppStats app={app} />
    </div>
  );
}

function PortfolioGroupCard({
  name,
  members,
}: {
  name: string;
  members: PortfolioApp[];
}) {
  const ordered = [...members].sort(
    (a, b) => STORE_ORDER[a.store] - STORE_ORDER[b.store],
  );

  return (
    <Card className="gap-0 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Link2 className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">{name}</span>
        <Badge variant="outline" className="ml-auto">
          Linked
        </Badge>
      </div>
      <ul className="flex flex-col divide-y">
        {ordered.map((member) => (
          <li key={member.id}>
            <PortfolioGroupMember app={member} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function PortfolioGrid({ apps }: { apps: PortfolioApp[] }) {
  const rows = toRows(apps);

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => (
        <li key={row.kind === "group" ? `group-${row.id}` : row.app.id}>
          {row.kind === "group" ? (
            <PortfolioGroupCard name={row.name} members={row.members} />
          ) : (
            <PortfolioCard app={row.app} />
          )}
        </li>
      ))}
    </ul>
  );
}
