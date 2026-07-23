import {
  AlertBatchAppSection,
  AlertPayload,
  MetadataChangedPayload,
  RankDroppedPayload,
  RankImprovedPayload,
  ReviewNegativePayload,
  SERP_DEPTH,
  SerpEntrantPayload,
  Store,
} from '@asobeast/shared';

const VALUE_MAX = 80;

export interface AlertBatchBlock {
  title: string;
  lines: string[];
}

export function position(value: number | null): string {
  return value === null ? 'outside top 100' : `#${value}`;
}

export function storeLabel(store: Store): string {
  return store === 'GOOGLE_PLAY' ? 'Google Play' : 'App Store';
}

export function rank(value: number | null): string {
  return value === null ? '>100' : `${value}`;
}

export function stars(score: number): string {
  return '★'.repeat(score) + '☆'.repeat(Math.max(0, 5 - score));
}

export function appLabel(name: string | null): string {
  return name ?? 'An app';
}

export function summarize(payload: AlertPayload): string {
  if (payload.event === 'metadata.changed') {
    const tag = payload.app.isCompetitor ? ' (competitor)' : '';
    const fields = payload.changes.map((change) => change.field).join(', ');
    return `${appLabel(payload.app.name)}${tag} changed ${fields}`;
  }

  if (payload.event === 'rank.dropped') {
    return `Rank drop: "${payload.keyword.text}" ${rank(payload.from)} → ${rank(payload.to)}`;
  }

  if (payload.event === 'rank.improved') {
    return `Rank up: "${payload.keyword.text}" ${rank(payload.from)} → ${rank(payload.to)}`;
  }

  if (payload.event === 'review.negative') {
    const version = payload.review.version
      ? ` (v${payload.review.version})`
      : '';
    return `${stars(payload.review.score)} review${version} for ${appLabel(payload.app.name)}`;
  }

  if (payload.event === 'serp.entrant') {
    const count = payload.entrants.length;
    return `${count} new entrant${count === 1 ? '' : 's'} in the top ${SERP_DEPTH} for "${payload.keyword.text}"`;
  }

  if (payload.event === 'alerts.batch') {
    const { events, apps } = payload.totals;
    return `${events} alert${events === 1 ? '' : 's'} across ${apps} app${apps === 1 ? '' : 's'}`;
  }

  return `Weekly digest: ${payload.apps.length} app${payload.apps.length === 1 ? '' : 's'}`;
}

export function truncateValue(raw: string | null): string {
  const value = raw ?? '—';
  return value.length > VALUE_MAX ? `${value.slice(0, VALUE_MAX - 1)}…` : value;
}

export function rankLine(
  alert: RankDroppedPayload | RankImprovedPayload,
): string {
  const arrow = alert.event === 'rank.dropped' ? '▼' : '▲';
  return `${alert.keyword.text}  ${rank(alert.from)} → ${rank(alert.to)} ${arrow}`;
}

export function entrantLines(entrant: SerpEntrantPayload): string[] {
  return entrant.entrants.map((item) => `#${item.position} · ${item.title}`);
}

export function changeLines(change: MetadataChangedPayload): string[] {
  return change.changes.map(
    (field) =>
      `${field.field}: ${truncateValue(field.before)} → ${truncateValue(field.after)}`,
  );
}

export function reviewLine(review: ReviewNegativePayload): string {
  const version = review.review.version ? ` — v${review.review.version}` : '';
  return `${stars(review.review.score)} "${truncateValue(review.review.text)}"${version}`;
}

export function appHeader(section: AlertBatchAppSection): string {
  return `${appLabel(section.app.name)} · ${storeLabel(section.app.store)} · ${section.app.country.toUpperCase()}`;
}

export function sectionBlocks(
  section: AlertBatchAppSection,
): AlertBatchBlock[] {
  const blocks: AlertBatchBlock[] = [];
  if (section.rankDrops.length > 0) {
    blocks.push({
      title: 'Rank drops',
      lines: section.rankDrops.map(rankLine),
    });
  }
  if (section.rankImprovements.length > 0) {
    blocks.push({
      title: 'Rank improvements',
      lines: section.rankImprovements.map(rankLine),
    });
  }
  if (section.serpEntrants.length > 0) {
    blocks.push({
      title: 'New entrants',
      lines: section.serpEntrants.flatMap(entrantLines),
    });
  }
  if (section.changes.length > 0) {
    blocks.push({
      title: 'Metadata changes',
      lines: section.changes.flatMap(changeLines),
    });
  }
  if (section.negativeReviews.length > 0) {
    blocks.push({
      title: 'Negative reviews',
      lines: section.negativeReviews.map(reviewLine),
    });
  }
  return blocks;
}

export function competitorBlocks(
  section: AlertBatchAppSection,
): AlertBatchBlock[] {
  return section.competitors
    .filter((competitor) => competitor.changes.length > 0)
    .map((competitor) => ({
      title: `Competitor · ${appLabel(competitor.app.name)} · ${storeLabel(competitor.app.store)}`,
      lines: competitor.changes.flatMap(changeLines),
    }));
}
