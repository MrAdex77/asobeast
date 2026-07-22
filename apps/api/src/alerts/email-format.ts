import {
  AlertBatchAppSection,
  AlertBatchPayload,
  AlertPayload,
  MetadataChangedPayload,
  RankDroppedPayload,
  RankImprovedPayload,
  ReviewNegativePayload,
  SerpEntrantPayload,
} from '@asobeast/shared';
import { appLabel, rank, stars, storeLabel, summarize } from './alert-summary';

const DIGEST_APP_CAP = 10;
const VALUE_MAX = 80;

export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

type Row = [string, string];

function value(raw: string | null): string {
  return raw ?? '—';
}

function signedDelta(delta: number | null): string {
  if (delta === null) {
    return '—';
  }
  const rounded = Math.round(delta * 10) / 10;
  return rounded >= 0 ? `+${rounded}` : `${rounded}`;
}

function detailRows(payload: Exclude<AlertPayload, AlertBatchPayload>): Row[] {
  if (payload.event === 'metadata.changed') {
    const rows: Row[] = [
      ['App', appLabel(payload.app.name)],
      ['Type', payload.app.isCompetitor ? 'Competitor' : 'Primary'],
    ];
    payload.changes.forEach((change) => {
      rows.push([
        change.field,
        `${value(change.before)} → ${value(change.after)}`,
      ]);
    });
    return rows;
  }

  if (payload.event === 'rank.dropped' || payload.event === 'rank.improved') {
    return [
      ['App', appLabel(payload.app.name)],
      ['Keyword', payload.keyword.text],
      ['From', rank(payload.from)],
      ['To', rank(payload.to)],
      ['Threshold', `${payload.threshold}`],
    ];
  }

  if (payload.event === 'review.negative') {
    return [
      ['App', appLabel(payload.app.name)],
      ['Rating', stars(payload.review.score)],
      ['Version', value(payload.review.version)],
      ['Title', value(payload.review.title)],
      ['Review', payload.review.text],
    ];
  }

  if (payload.event === 'serp.entrant') {
    return [
      ['Keyword', payload.keyword.text],
      ['Date', payload.date],
      ...payload.entrants.map((entrant): Row => [
        `#${entrant.position}`,
        entrant.isCompetitor ? `${entrant.title} (competitor)` : entrant.title,
      ]),
    ];
  }

  const rows: Row[] = [
    ['Window', `${payload.window.from} → ${payload.window.to}`],
  ];
  if (payload.groups.length > 0) {
    rows.push(['', 'Linked apps']);
    payload.groups.forEach((group) => {
      rows.push([
        group.name,
        `vis ${Math.round(group.visibility.current)} (${signedDelta(group.visibility.delta7d)})`,
      ]);
    });
  }
  payload.apps.slice(0, DIGEST_APP_CAP).forEach((app) => {
    const cells = [
      `vis ${Math.round(app.visibility.current)} (${signedDelta(app.visibility.delta7d)})`,
    ];
    if (app.audit && app.audit.current !== null) {
      cells.push(
        `Audit ${Math.round(app.audit.current)} (${signedDelta(app.audit.delta7d)})`,
      );
    }
    rows.push([appLabel(app.name), cells.join(' · ')]);
  });
  if (payload.apps.length > DIGEST_APP_CAP) {
    rows.push(['', `+${payload.apps.length - DIGEST_APP_CAP} more`]);
  }
  return rows;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function htmlRow([label, cell]: Row): string {
  return `<tr><td style="padding:4px 12px 4px 0;color:#64748b;vertical-align:top">${escapeHtml(label)}</td><td style="padding:4px 0">${escapeHtml(cell)}</td></tr>`;
}

export function formatEmail(payload: AlertPayload): EmailContent {
  if (payload.event === 'alerts.batch') {
    return formatBatchEmail(payload);
  }
  const summary = summarize(payload);
  const rows = detailRows(payload);

  const text = [
    summary,
    '',
    ...rows.map(([label, cell]) => (label ? `${label}: ${cell}` : cell)),
    '',
    `Occurred at ${payload.occurredAt}`,
  ].join('\n');

  const html = [
    `<div style="font-family:system-ui,-apple-system,sans-serif;color:#0f172a">`,
    `<p style="font-size:16px;font-weight:600;margin:0 0 12px">${escapeHtml(summary)}</p>`,
    `<table style="border-collapse:collapse;font-size:14px">${rows.map(htmlRow).join('')}</table>`,
    `<p style="font-size:12px;color:#94a3b8;margin:16px 0 0">Occurred at ${escapeHtml(payload.occurredAt)}</p>`,
    `</div>`,
  ].join('');

  return { subject: `[asobeast] ${summary}`, text, html };
}

function truncate(raw: string | null): string {
  const value = raw ?? '—';
  return value.length > VALUE_MAX ? `${value.slice(0, VALUE_MAX - 1)}…` : value;
}

function plural(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

interface BatchCounts {
  rankDrops: number;
  rankImprovements: number;
  serpEntrants: number;
  changes: number;
  negativeReviews: number;
  competitorChanges: number;
}

function countBatch(payload: AlertBatchPayload): BatchCounts {
  const counts: BatchCounts = {
    rankDrops: 0,
    rankImprovements: 0,
    serpEntrants: 0,
    changes: 0,
    negativeReviews: 0,
    competitorChanges: 0,
  };
  for (const section of payload.apps) {
    counts.rankDrops += section.rankDrops.length;
    counts.rankImprovements += section.rankImprovements.length;
    counts.serpEntrants += section.serpEntrants.length;
    counts.changes += section.changes.length;
    counts.negativeReviews += section.negativeReviews.length;
    counts.competitorChanges += section.competitors.reduce(
      (total, competitor) => total + competitor.changes.length,
      0,
    );
  }
  return counts;
}

function batchSubject(payload: AlertBatchPayload): string {
  const counts = countBatch(payload);
  const parts = [
    counts.rankDrops > 0 ? plural(counts.rankDrops, 'rank drop') : null,
    counts.rankImprovements > 0
      ? plural(counts.rankImprovements, 'rank improvement')
      : null,
    counts.serpEntrants > 0 ? plural(counts.serpEntrants, 'entrant') : null,
    counts.changes > 0 ? plural(counts.changes, 'metadata change') : null,
    counts.negativeReviews > 0
      ? plural(counts.negativeReviews, 'negative review')
      : null,
    counts.competitorChanges > 0
      ? plural(counts.competitorChanges, 'competitor change')
      : null,
  ].filter((part): part is string => part !== null);

  const headline = parts.length > 0 ? parts.join(', ') : 'no changes';
  const apps = plural(payload.apps.length, 'app');
  return `[asobeast] ${headline} across ${apps}`;
}

function rankLine(alert: RankDroppedPayload | RankImprovedPayload): string {
  const arrow = alert.event === 'rank.dropped' ? '▼' : '▲';
  return `${alert.keyword.text}  ${rank(alert.from)} → ${rank(alert.to)} ${arrow}`;
}

function entrantLines(entrant: SerpEntrantPayload): string[] {
  return entrant.entrants.map((item) => `#${item.position} · ${item.title}`);
}

function changeLines(change: MetadataChangedPayload): string[] {
  return change.changes.map(
    (field) =>
      `${field.field}: ${truncate(field.before)} → ${truncate(field.after)}`,
  );
}

function reviewLine(review: ReviewNegativePayload): string {
  const version = review.review.version ? ` — v${review.review.version}` : '';
  return `${stars(review.review.score)} "${truncate(review.review.text)}"${version}`;
}

interface TextBlock {
  title: string;
  lines: string[];
}

function sectionBlocks(section: AlertBatchAppSection): TextBlock[] {
  const blocks: TextBlock[] = [];
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

function appHeader(section: AlertBatchAppSection): string {
  return `${appLabel(section.app.name)} · ${storeLabel(section.app.store)} · ${section.app.country.toUpperCase()}`;
}

function batchText(payload: AlertBatchPayload): string {
  const lines: string[] = [];
  for (const section of payload.apps) {
    lines.push(appHeader(section));
    for (const block of sectionBlocks(section)) {
      lines.push(`  ${block.title}`);
      block.lines.forEach((line) => lines.push(`    ${line}`));
    }
    for (const competitor of section.competitors) {
      lines.push(
        `  Competitor activity — ${appLabel(competitor.app.name)} · ${storeLabel(competitor.app.store)}`,
      );
      competitor.changes.flatMap(changeLines).forEach((line) => {
        lines.push(`    ${line}`);
      });
    }
    lines.push('');
  }
  lines.push(`Window ${payload.window.from} → ${payload.window.to}`);
  return lines.join('\n');
}

function htmlList(lines: string[]): string {
  const items = lines
    .map((line) => `<li style="margin:2px 0">${escapeHtml(line)}</li>`)
    .join('');
  return `<ul style="margin:4px 0 8px;padding-left:18px">${items}</ul>`;
}

function htmlBlock(block: TextBlock): string {
  return `<p style="margin:8px 0 2px;font-weight:600;font-size:13px">${escapeHtml(block.title)}</p>${htmlList(block.lines)}`;
}

function htmlCompetitor(
  competitor: AlertBatchAppSection['competitors'][number],
): string {
  const heading = `${appLabel(competitor.app.name)} · ${storeLabel(competitor.app.store)}`;
  return `<p style="margin:8px 0 2px;font-weight:600;font-size:13px;color:#64748b">Competitor · ${escapeHtml(heading)}</p>${htmlList(competitor.changes.flatMap(changeLines))}`;
}

function htmlCard(section: AlertBatchAppSection): string {
  const blocks = sectionBlocks(section).map(htmlBlock).join('');
  const competitors = section.competitors.map(htmlCompetitor).join('');
  return [
    `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin:0 0 12px">`,
    `<p style="margin:0 0 4px;font-weight:700;font-size:15px">${escapeHtml(appHeader(section))}</p>`,
    blocks,
    competitors,
    `</div>`,
  ].join('');
}

export function formatBatchEmail(payload: AlertBatchPayload): EmailContent {
  const subject = batchSubject(payload);
  const text = batchText(payload);
  const html = [
    `<div style="font-family:system-ui,-apple-system,sans-serif;color:#0f172a">`,
    `<p style="font-size:16px;font-weight:600;margin:0 0 12px">${escapeHtml(subject.replace('[asobeast] ', ''))}</p>`,
    payload.apps.map(htmlCard).join(''),
    `<p style="font-size:12px;color:#94a3b8;margin:12px 0 0">Window ${escapeHtml(payload.window.from)} → ${escapeHtml(payload.window.to)}</p>`,
    `</div>`,
  ].join('');

  return { subject, text, html };
}
