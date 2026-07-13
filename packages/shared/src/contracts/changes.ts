import type { ReviewNegativePayload } from './reviews';

export const CHANGE_FIELDS = [
  'title',
  'subtitle',
  'summary',
  'description',
  'version',
  'price',
  'screenshots',
  'icon',
] as const;
export type ChangeField = (typeof CHANGE_FIELDS)[number];

export interface ChangeEventItem {
  id: string;
  appId: string;
  appName: string | null;
  isCompetitor: boolean;
  field: ChangeField;
  before: string | null;
  after: string | null;
  capturedAt: string;
}

export interface ChangeTimeline {
  events: ChangeEventItem[];
}

export const WEBHOOK_EVENTS = [
  'metadata.changed',
  'rank.dropped',
  'rank.improved',
  'review.negative',
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface WebhookItem {
  id: string;
  url: string;
  events: WebhookEvent[];
  active: boolean;
  hasSecret: boolean;
  createdAt: string;
}

export interface WebhookTestResult {
  delivered: boolean;
  status: number | null;
}

export interface MetadataChangedPayload {
  event: 'metadata.changed';
  occurredAt: string;
  app: { id: string; name: string | null; isCompetitor: boolean };
  changes: Array<{
    field: ChangeField;
    before: string | null;
    after: string | null;
  }>;
}

export interface RankDroppedPayload {
  event: 'rank.dropped';
  occurredAt: string;
  app: { id: string; name: string | null };
  keyword: { id: string; text: string };
  from: number;
  to: number | null;
  threshold: number;
}

export interface RankImprovedPayload {
  event: 'rank.improved';
  occurredAt: string;
  app: { id: string; name: string | null };
  keyword: { id: string; text: string };
  from: number | null;
  to: number;
  threshold: number;
}

export type AlertPayload =
  | MetadataChangedPayload
  | RankDroppedPayload
  | RankImprovedPayload
  | ReviewNegativePayload;
