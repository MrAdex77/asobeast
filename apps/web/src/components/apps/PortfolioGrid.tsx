import Link from "next/link";
import { Globe, Link2 } from "lucide-react";
import type { PortfolioApp, PortfolioGroup, Store } from "@asobeast/shared";
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

type GroupVariant = "linked" | "storefront";

type PortfolioRow =
  | { kind: "app"; app: PortfolioApp }
  | {
      kind: "group";
      id: string;
      name: string;
      variant: GroupVariant;
      members: PortfolioApp[];
    };

function storefrontKey(app: PortfolioApp): string {
  return `${app.store}:${app.storeAppId}`;
}

function toRows(apps: PortfolioApp[]): PortfolioRow[] {
  const storefrontCounts = new Map<string, number>();
  for (const app of apps) {
    if (app.groupId === null) {
      const key = storefrontKey(app);
      storefrontCounts.set(key, (storefrontCounts.get(key) ?? 0) + 1);
    }
  }

  const rows: PortfolioRow[] = [];
  const groupRowIndex = new Map<string, number>();

  const pushMember = (
    key: string,
    row: Omit<PortfolioRow & { kind: "group" }, "members">,
    app: PortfolioApp,
  ) => {
    const existing = groupRowIndex.get(key);
    if (existing === undefined) {
      groupRowIndex.set(key, rows.length);
      rows.push({ ...row, members: [app] });
      return;
    }
    (rows[existing] as { members: PortfolioApp[] }).members.push(app);
  };

  for (const app of apps) {
    if (app.groupId !== null) {
      pushMember(
        `group:${app.groupId}`,
        {
          kind: "group",
          id: app.groupId,
          name: app.groupName ?? app.name ?? "App group",
          variant: "linked",
        },
        app,
      );
      continue;
    }

    const key = storefrontKey(app);
    if ((storefrontCounts.get(key) ?? 0) < 2) {
      rows.push({ kind: "app", app });
      continue;
    }

    pushMember(
      `storefront:${key}`,
      {
        kind: "group",
        id: key,
        name: app.name ?? "Untitled app",
        variant: "storefront",
      },
      app,
    );
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

function GroupVisibility({ group }: { group: PortfolioGroup | undefined }) {
  if (!group) {
    return (
      <span className="text-3xl font-semibold text-muted-foreground tabular-nums">
        —
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-3xl font-semibold tabular-nums">
          {Math.round(group.visibility.current)}
        </span>
        <TrendChip label="7d" value={group.visibility.delta7d} />
      </div>
      <Sparkline points={group.sparkline} />
    </div>
  );
}

function PortfolioGroupCard({
  name,
  members,
  variant,
  group,
}: {
  name: string;
  members: PortfolioApp[];
  variant: GroupVariant;
  group: PortfolioGroup | undefined;
}) {
  const ordered = [...members].sort(
    (a, b) =>
      STORE_ORDER[a.store] - STORE_ORDER[b.store] ||
      a.country.localeCompare(b.country),
  );
  const storefront = variant === "storefront";
  const Icon = storefront ? Globe : Link2;

  return (
    <Card className="gap-0 p-4">
      <div className="mb-3 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">{name}</span>
          <Badge variant="outline" className="ml-auto">
            {storefront ? "Storefronts" : "Linked"}
          </Badge>
        </div>
        {storefront ? null : <GroupVisibility group={group} />}
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

export function PortfolioGrid({
  apps,
  groups,
}: {
  apps: PortfolioApp[];
  groups: PortfolioGroup[];
}) {
  const rows = toRows(apps);
  const byId = new Map(groups.map((group) => [group.id, group]));

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => (
        <li key={row.kind === "group" ? `${row.variant}-${row.id}` : row.app.id}>
          {row.kind === "group" ? (
            <PortfolioGroupCard
              name={row.name}
              members={row.members}
              variant={row.variant}
              group={byId.get(row.id)}
            />
          ) : (
            <PortfolioCard app={row.app} />
          )}
        </li>
      ))}
    </ul>
  );
}
