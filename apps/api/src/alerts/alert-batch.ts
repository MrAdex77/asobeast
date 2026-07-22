import {
  AlertBatchApp,
  AlertBatchAppSection,
  AlertBatchCompetitorSection,
  AlertBatchPayload,
  AlertPayload,
  MetadataChangedPayload,
  RankDroppedPayload,
  RankImprovedPayload,
  ReviewNegativePayload,
  SerpEntrantPayload,
} from '@asobeast/shared';

export interface ResolvedApp {
  id: string;
  name: string | null;
  store: AlertBatchApp['store'];
  country: string;
  isCompetitor: boolean;
  primaryAppId: string | null;
}

export interface OutboxEvent {
  event: string;
  appId: string | null;
  payload: AlertPayload;
  createdAt: Date;
}

export interface AssembleInput {
  events: OutboxEvent[];
  appById: Map<string, ResolvedApp>;
  serpPrimariesByKeyword: Map<string, string[]>;
  now: Date;
}

interface MutableSection {
  app: AlertBatchApp;
  rankDrops: RankDroppedPayload[];
  rankImprovements: RankImprovedPayload[];
  serpEntrants: SerpEntrantPayload[];
  changes: MetadataChangedPayload[];
  negativeReviews: ReviewNegativePayload[];
  competitors: Map<string, AlertBatchCompetitorSection>;
}

function toBatchApp(app: ResolvedApp): AlertBatchApp {
  return { id: app.id, name: app.name, store: app.store, country: app.country };
}

function byName(a: { app: AlertBatchApp }, b: { app: AlertBatchApp }): number {
  return (a.app.name ?? '').localeCompare(b.app.name ?? '');
}

export function assembleBatch(input: AssembleInput): AlertBatchPayload {
  const { events, appById, serpPrimariesByKeyword, now } = input;
  const sections = new Map<string, MutableSection>();

  const sectionFor = (app: ResolvedApp): MutableSection => {
    let section = sections.get(app.id);
    if (!section) {
      section = {
        app: toBatchApp(app),
        rankDrops: [],
        rankImprovements: [],
        serpEntrants: [],
        changes: [],
        negativeReviews: [],
        competitors: new Map(),
      };
      sections.set(app.id, section);
    }
    return section;
  };

  for (const { payload } of events) {
    if (payload.event === 'rank.dropped') {
      const app = appById.get(payload.app.id);
      if (app) {
        sectionFor(app).rankDrops.push(payload);
      }
    } else if (payload.event === 'rank.improved') {
      const app = appById.get(payload.app.id);
      if (app) {
        sectionFor(app).rankImprovements.push(payload);
      }
    } else if (payload.event === 'review.negative') {
      const app = appById.get(payload.app.id);
      if (app) {
        sectionFor(app).negativeReviews.push(payload);
      }
    } else if (payload.event === 'metadata.changed') {
      const app = appById.get(payload.app.id);
      if (!app) {
        continue;
      }
      if (app.isCompetitor) {
        const primary = app.primaryAppId
          ? appById.get(app.primaryAppId)
          : undefined;
        if (!primary) {
          continue;
        }
        const section = sectionFor(primary);
        let competitor = section.competitors.get(app.id);
        if (!competitor) {
          competitor = { app: toBatchApp(app), changes: [] };
          section.competitors.set(app.id, competitor);
        }
        competitor.changes.push(payload);
      } else {
        sectionFor(app).changes.push(payload);
      }
    } else if (payload.event === 'serp.entrant') {
      const primaries = serpPrimariesByKeyword.get(payload.keyword.id) ?? [];
      for (const primaryId of primaries) {
        const primary = appById.get(primaryId);
        if (primary) {
          sectionFor(primary).serpEntrants.push(payload);
        }
      }
    }
  }

  const apps = [...sections.values()]
    .map((section): AlertBatchAppSection => ({
      app: section.app,
      rankDrops: section.rankDrops,
      rankImprovements: section.rankImprovements,
      serpEntrants: section.serpEntrants,
      changes: section.changes,
      negativeReviews: section.negativeReviews,
      competitors: [...section.competitors.values()].sort(byName),
    }))
    .sort(byName);

  const flat = events.map((event) => event.payload);
  const from =
    events.length > 0 ? events[0].createdAt.toISOString() : now.toISOString();

  return {
    event: 'alerts.batch',
    occurredAt: now.toISOString(),
    window: { from, to: now.toISOString() },
    totals: { events: flat.length, apps: apps.length },
    apps,
    events: flat,
  };
}

function sectionHasContent(section: AlertBatchAppSection): boolean {
  return (
    section.rankDrops.length > 0 ||
    section.rankImprovements.length > 0 ||
    section.serpEntrants.length > 0 ||
    section.changes.length > 0 ||
    section.negativeReviews.length > 0 ||
    section.competitors.length > 0
  );
}

export function filterBatch(
  batch: AlertBatchPayload,
  allowed: Set<string>,
): AlertBatchPayload {
  const events = batch.events.filter((event) => allowed.has(event.event));
  const apps = batch.apps
    .map((section): AlertBatchAppSection => ({
      app: section.app,
      rankDrops: allowed.has('rank.dropped') ? section.rankDrops : [],
      rankImprovements: allowed.has('rank.improved')
        ? section.rankImprovements
        : [],
      serpEntrants: allowed.has('serp.entrant') ? section.serpEntrants : [],
      changes: allowed.has('metadata.changed') ? section.changes : [],
      negativeReviews: allowed.has('review.negative')
        ? section.negativeReviews
        : [],
      competitors: allowed.has('metadata.changed') ? section.competitors : [],
    }))
    .filter(sectionHasContent);

  return {
    ...batch,
    apps,
    events,
    totals: { events: events.length, apps: apps.length },
  };
}
