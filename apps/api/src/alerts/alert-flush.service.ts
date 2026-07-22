import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  AlertBatchPayload,
  AlertFlushResult,
  AlertPayload,
} from '@asobeast/shared';
import { DEFAULT_WORKSPACE_ID } from '../common/workspace';
import {
  DeliverAlertPayload,
  DeliverEmailPayload,
  JOBS,
  QUEUES,
} from '../jobs/jobs.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  assembleBatch,
  filterBatch,
  OutboxEvent,
  ResolvedApp,
} from './alert-batch';
import { MailerService } from './mailer.service';

const APP_SELECT = {
  id: true,
  name: true,
  store: true,
  country: true,
  isCompetitor: true,
  primaryAppId: true,
} as const;

@Injectable()
export class AlertFlushService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    @InjectQueue(QUEUES.ALERTS)
    private readonly queue: Queue<DeliverAlertPayload | DeliverEmailPayload>,
  ) {}

  async flush(): Promise<AlertFlushResult> {
    const rows = await this.prisma.alertEvent.findMany({
      where: { workspaceId: DEFAULT_WORKSPACE_ID, flushedAt: null },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        event: true,
        appId: true,
        payload: true,
        createdAt: true,
      },
    });
    if (rows.length === 0) {
      return { flushed: 0, channels: 0 };
    }

    const events: OutboxEvent[] = rows.map((row) => ({
      event: row.event,
      appId: row.appId,
      payload: row.payload as unknown as AlertPayload,
      createdAt: row.createdAt,
    }));

    const { appById, serpPrimariesByKeyword } = await this.resolve(events);
    const batch = assembleBatch({
      events,
      appById,
      serpPrimariesByKeyword,
      now: new Date(),
    });

    await this.prisma.alertEvent.updateMany({
      where: { id: { in: rows.map((row) => row.id) } },
      data: { flushedAt: new Date() },
    });

    const channels = await this.enqueue(batch);
    return { flushed: rows.length, channels };
  }

  private async resolve(events: OutboxEvent[]): Promise<{
    appById: Map<string, ResolvedApp>;
    serpPrimariesByKeyword: Map<string, string[]>;
  }> {
    const appIds = new Set<string>();
    const keywordIds = new Set<string>();
    for (const { appId, payload } of events) {
      if (appId) {
        appIds.add(appId);
      }
      if (payload.event === 'serp.entrant') {
        keywordIds.add(payload.keyword.id);
      }
    }

    const appById = new Map<string, ResolvedApp>();
    const rows = await this.prisma.app.findMany({
      where: { id: { in: [...appIds] } },
      select: APP_SELECT,
    });
    rows.forEach((app) => appById.set(app.id, app));

    const missing = rows
      .filter(
        (app) =>
          app.isCompetitor &&
          app.primaryAppId &&
          !appById.has(app.primaryAppId),
      )
      .map((app) => app.primaryAppId as string);
    if (missing.length > 0) {
      const primaries = await this.prisma.app.findMany({
        where: { id: { in: missing } },
        select: APP_SELECT,
      });
      primaries.forEach((app) => appById.set(app.id, app));
    }

    const serpPrimariesByKeyword = new Map<string, string[]>();
    if (keywordIds.size > 0) {
      const tracked = await this.prisma.trackedKeyword.findMany({
        where: {
          keywordId: { in: [...keywordIds] },
          active: true,
          app: { isCompetitor: false },
        },
        select: { keywordId: true, app: { select: APP_SELECT } },
      });
      for (const { keywordId, app } of tracked) {
        appById.set(app.id, app);
        const list = serpPrimariesByKeyword.get(keywordId) ?? [];
        list.push(app.id);
        serpPrimariesByKeyword.set(keywordId, list);
      }
    }

    return { appById, serpPrimariesByKeyword };
  }

  private async enqueue(batch: AlertBatchPayload): Promise<number> {
    let channels = 0;

    const webhooks = await this.prisma.webhook.findMany({
      where: { workspaceId: DEFAULT_WORKSPACE_ID, active: true },
      select: { id: true, events: true },
    });
    for (const webhook of webhooks) {
      const filtered = filterBatch(batch, new Set(webhook.events));
      if (filtered.events.length === 0) {
        continue;
      }
      await this.queue.add(JOBS.DELIVER_ALERT, {
        webhookId: webhook.id,
        payload: filtered,
      });
      channels += 1;
    }

    if (this.mailer.enabled) {
      const emails = await this.prisma.emailAlert.findMany({
        where: { workspaceId: DEFAULT_WORKSPACE_ID, active: true },
        select: { id: true, events: true },
      });
      for (const email of emails) {
        const filtered = filterBatch(batch, new Set(email.events));
        if (filtered.events.length === 0) {
          continue;
        }
        await this.queue.add(JOBS.DELIVER_EMAIL, {
          emailAlertId: email.id,
          payload: filtered,
        });
        channels += 1;
      }
    }

    return channels;
  }
}
