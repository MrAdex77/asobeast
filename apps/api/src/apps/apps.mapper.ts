import { App, AppSnapshot } from '@prisma/client';
import {
  AppDetail,
  AppListItem,
  AppSnapshotSummary,
  CompetitorItem,
} from '@asobeast/shared';

export function toSnapshotSummary(snapshot: AppSnapshot): AppSnapshotSummary {
  return {
    id: snapshot.id,
    title: snapshot.title,
    subtitle: snapshot.subtitle,
    summary: snapshot.summary,
    ratingAvg: snapshot.ratingAvg,
    ratingCount: snapshot.ratingCount,
    installs: snapshot.installs === null ? null : Number(snapshot.installs),
    price: snapshot.price,
    version: snapshot.version,
    capturedAt: snapshot.capturedAt.toISOString(),
  };
}

export function toCompetitorItem(
  app: App,
  snapshot: AppSnapshot | null,
): CompetitorItem {
  return {
    id: app.id,
    store: app.store,
    name: app.name,
    iconUrl: app.iconUrl,
    latestSnapshot: snapshot ? toSnapshotSummary(snapshot) : null,
  };
}

export function toAppListItem(
  app: App,
  snapshot: AppSnapshot | null,
  trackedKeywordCount: number,
  competitorCount: number,
): AppListItem {
  return {
    id: app.id,
    store: app.store,
    name: app.name,
    iconUrl: app.iconUrl,
    ratingAvg: snapshot?.ratingAvg ?? null,
    ratingCount: snapshot?.ratingCount ?? null,
    capturedAt: snapshot ? snapshot.capturedAt.toISOString() : null,
    trackedKeywordCount,
    competitorCount,
  };
}

export type CompetitorWithSnapshot = App & { snapshots: AppSnapshot[] };

export function toAppDetail(
  app: App,
  snapshot: AppSnapshot | null,
  competitors: CompetitorWithSnapshot[],
): AppDetail {
  return {
    id: app.id,
    store: app.store,
    storeAppId: app.storeAppId,
    country: app.country,
    name: app.name,
    iconUrl: app.iconUrl,
    createdAt: app.createdAt.toISOString(),
    latestSnapshot: snapshot ? toSnapshotSummary(snapshot) : null,
    competitors: competitors.map((competitor) =>
      toCompetitorItem(competitor, competitor.snapshots[0] ?? null),
    ),
  };
}
