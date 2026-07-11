import { AlertPayload } from '@asobeast/shared';

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

export function renderMessage(payload: AlertPayload): string {
  if (payload.event === 'metadata.changed') {
    const who = payload.app.name ?? 'An app';
    const tag = payload.app.isCompetitor ? ' (competitor)' : '';
    const fields = payload.changes.map((change) => change.field).join(', ');
    return `📝 ${who}${tag} changed: ${fields}`;
  }

  const who = payload.app.name ?? 'An app';
  const icon = payload.event === 'rank.dropped' ? '📉' : '📈';
  const verb = payload.event === 'rank.dropped' ? 'dropped' : 'improved';
  return `${icon} ${who} ${verb} for "${payload.keyword.text}": ${position(payload.from)} → ${position(payload.to)}`;
}

export function formatWebhookBody(url: string, payload: AlertPayload): string {
  if (isDiscord(url)) {
    return JSON.stringify({ content: renderMessage(payload) });
  }
  if (isSlack(url)) {
    return JSON.stringify({ text: renderMessage(payload) });
  }
  return JSON.stringify(payload);
}
