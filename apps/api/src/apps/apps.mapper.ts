import { App, AppSnapshot } from '@prisma/client';
import {
  AppDetail,
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

export function toCompetitorItem(app: App): CompetitorItem {
  return {
    id: app.id,
    store: app.store,
    name: app.name,
    iconUrl: app.iconUrl,
  };
}

export function toAppDetail(
  app: App,
  snapshot: AppSnapshot | null,
  competitors: App[],
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
    competitors: competitors.map(toCompetitorItem),
  };
}
