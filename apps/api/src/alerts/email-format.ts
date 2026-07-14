import { AlertPayload } from '@asobeast/shared';
import { appLabel, rank, stars, summarize } from './alert-summary';

const DIGEST_APP_CAP = 10;

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

function detailRows(payload: AlertPayload): Row[] {
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

  const rows: Row[] = [
    ['Window', `${payload.window.from} → ${payload.window.to}`],
  ];
  payload.apps.slice(0, DIGEST_APP_CAP).forEach((app) => {
    rows.push([
      appLabel(app.name),
      `vis ${Math.round(app.visibility.current)} (${signedDelta(app.visibility.delta7d)})`,
    ]);
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
