import {
  AlertBatchAppSection,
  AlertBatchPayload,
  AlertPayload,
  DigestWeeklyPayload,
  SERP_DEPTH,
} from '@asobeast/shared';
import {
  AlertBatchBlock,
  appHeader,
  competitorBlocks,
  position,
  sectionBlocks,
  stars,
} from './alert-summary';

const DIGEST_APP_CAP = 10;
const BATCH_APP_CAP = 10;
const DISCORD_FIELD_MAX = 1000;
const DISCORD_TOTAL_MAX = 5500;
const DISCORD_NAME_MAX = 256;
const SLACK_SECTION_MAX = 2900;

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

  if (payload.event === 'serp.entrant') {
    const names = payload.entrants
      .map((entrant) => `${position(entrant.position)} ${entrant.title}`)
      .join(', ');
    return `🆕 New in the top ${SERP_DEPTH} for "${payload.keyword.text}": ${names}`;
  }

  if (payload.event === 'alerts.batch') {
    const { events, apps } = payload.totals;
    return `📦 ${events} alert${events === 1 ? '' : 's'} across ${apps} app${apps === 1 ? '' : 's'}`;
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

function clamp(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function allBatchBlocks(section: AlertBatchAppSection): AlertBatchBlock[] {
  return [...sectionBlocks(section), ...competitorBlocks(section)];
}

function renderBatchBlocks(
  blocks: AlertBatchBlock[],
  bold: (text: string) => string,
): string {
  return blocks
    .map((block) => [bold(block.title), ...block.lines].join('\n'))
    .join('\n');
}

function moreAppsLine(total: number, shown: number): string | null {
  const remaining = total - shown;
  if (remaining <= 0) {
    return null;
  }
  return `+${remaining} more app${remaining === 1 ? '' : 's'}`;
}

function batchWindow(payload: AlertBatchPayload): string {
  return `Window ${payload.window.from} → ${payload.window.to}`;
}

function batchDiscordBody(payload: AlertBatchPayload): unknown {
  const bold = (text: string): string => `**${text}**`;
  const fields: { name: string; value: string }[] = [];
  let used = 0;
  let shown = 0;
  for (const section of payload.apps) {
    if (shown >= BATCH_APP_CAP) {
      break;
    }
    const value = clamp(
      renderBatchBlocks(allBatchBlocks(section), bold),
      DISCORD_FIELD_MAX,
    );
    if (value.length === 0) {
      continue;
    }
    if (used + value.length > DISCORD_TOTAL_MAX) {
      break;
    }
    fields.push({ name: clamp(appHeader(section), DISCORD_NAME_MAX), value });
    used += value.length;
    shown += 1;
  }
  const more = moreAppsLine(payload.apps.length, shown);
  if (more) {
    fields.push({ name: '…', value: more });
  }
  return {
    embeds: [
      {
        title: clamp(renderMessage(payload), DISCORD_NAME_MAX),
        description: batchWindow(payload),
        fields,
      },
    ],
  };
}

function batchSlackBody(payload: AlertBatchPayload): unknown {
  const bold = (text: string): string => `*${text}*`;
  const blocks: unknown[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: clamp(renderMessage(payload), 150) },
    },
  ];
  let shown = 0;
  for (const section of payload.apps) {
    if (shown >= BATCH_APP_CAP) {
      break;
    }
    const detail = renderBatchBlocks(allBatchBlocks(section), bold);
    if (detail.length === 0) {
      continue;
    }
    const text = clamp(
      `${bold(appHeader(section))}\n${detail}`,
      SLACK_SECTION_MAX,
    );
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text } });
    shown += 1;
  }
  const more = moreAppsLine(payload.apps.length, shown);
  if (more) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: more } });
  }
  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: batchWindow(payload) }],
  });
  return { blocks };
}

export function formatWebhookBody(url: string, payload: AlertPayload): string {
  if (payload.event === 'alerts.batch') {
    if (isDiscord(url)) {
      return JSON.stringify(batchDiscordBody(payload));
    }
    if (isSlack(url)) {
      return JSON.stringify(batchSlackBody(payload));
    }
    return JSON.stringify(payload);
  }
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
