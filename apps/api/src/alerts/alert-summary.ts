import { AlertPayload, SERP_DEPTH, Store } from '@asobeast/shared';

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
