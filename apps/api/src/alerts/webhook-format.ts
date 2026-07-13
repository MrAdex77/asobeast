import { AlertPayload, DigestWeeklyPayload } from '@asobeast/shared';

const DIGEST_APP_CAP = 10;

function host(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function isDiscord(url: string): boolean {
  const name = host(url);
  return name === 'discord.com' || name === 'discordapp.com';
}

function isSlack(url: string): boolean {
  return host(url) === 'hooks.slack.com';
}

function position(value: number | null): string {
  return value === null ? 'outside top 100' : `#${value}`;
}

function stars(score: number): string {
  return '★'.repeat(score) + '☆'.repeat(Math.max(0, 5 - score));
}

export function renderMessage(payload: AlertPayload): string {
  if (payload.event === 'metadata.changed') {
    const who = payload.app.name ?? 'An app';
    const tag = payload.app.isCompetitor ? ' (competitor)' : '';
    const fields = payload.changes.map((change) => change.field).join(', ');
    return `📝 ${who}${tag} changed: ${fields}`;
  }

  if (payload.event === 'review.negative') {
    const who = payload.app.name ?? 'An app';
    const version = payload.review.version
      ? ` (v${payload.review.version})`
      : '';
    return `⚠️ ${who} got a ${stars(payload.review.score)} review${version}: "${payload.review.text}"`;
  }

  if (payload.event === 'digest.weekly') {
    return `🗓️ Weekly digest: ${payload.apps.length} app${payload.apps.length === 1 ? '' : 's'}`;
  }

  const who = payload.app.name ?? 'An app';
  const icon = payload.event === 'rank.dropped' ? '📉' : '📈';
  const verb = payload.event === 'rank.dropped' ? 'dropped' : 'improved';
  return `${icon} ${who} ${verb} for "${payload.keyword.text}": ${position(payload.from)} → ${position(payload.to)}`;
}

function signedDelta(value: number | null): string {
  if (value === null) {
    return '—';
  }
  const rounded = Math.round(value * 10) / 10;
  return rounded >= 0 ? `+${rounded}` : `${rounded}`;
}

function digestTitle(payload: DigestWeeklyPayload): string {
  return `🗓️ Weekly digest · ${payload.window.from} → ${payload.window.to}`;
}

function digestAppLine(app: DigestWeeklyPayload['apps'][number]): string {
  const parts = [
    `${app.name ?? 'App'} — vis ${Math.round(app.visibility.current)} (${signedDelta(app.visibility.delta7d)})`,
  ];
  const up = app.moversUp[0];
  if (up) {
    parts.push(`↑ ${up.text} ${position(up.from)}→${position(up.to)}`);
  }
  const down = app.moversDown[0];
  if (down) {
    parts.push(`↓ ${down.text} ${position(down.from)}→${position(down.to)}`);
  }
  parts.push(`${app.changes} change${app.changes === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

function digestLines(payload: DigestWeeklyPayload): string[] {
  const lines = payload.apps.slice(0, DIGEST_APP_CAP).map(digestAppLine);
  if (payload.apps.length > DIGEST_APP_CAP) {
    lines.push(`+${payload.apps.length - DIGEST_APP_CAP} more`);
  }
  return lines;
}

function digestDiscordBody(payload: DigestWeeklyPayload): unknown {
  return {
    embeds: [
      {
        title: digestTitle(payload),
        description: digestLines(payload).join('\n'),
      },
    ],
  };
}

function digestSlackBody(payload: DigestWeeklyPayload): unknown {
  return {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: digestTitle(payload) },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: digestLines(payload).join('\n') },
      },
    ],
  };
}

export function formatWebhookBody(url: string, payload: AlertPayload): string {
  if (payload.event === 'digest.weekly') {
    if (isDiscord(url)) {
      return JSON.stringify(digestDiscordBody(payload));
    }
    if (isSlack(url)) {
      return JSON.stringify(digestSlackBody(payload));
    }
    return JSON.stringify(payload);
  }
  if (isDiscord(url)) {
    return JSON.stringify({ content: renderMessage(payload) });
  }
  if (isSlack(url)) {
    return JSON.stringify({ text: renderMessage(payload) });
  }
  return JSON.stringify(payload);
}
