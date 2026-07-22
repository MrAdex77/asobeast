import { execSync } from 'child_process';
import { join } from 'path';
import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Store } from '@prisma/client';
import {
  AlertBatchPayload,
  AlertFlushResult,
  MetadataChangedPayload,
  RankDroppedPayload,
} from '@asobeast/shared';
import { Job, Queue } from 'bullmq';
import request from 'supertest';
import { App } from 'supertest/types';
import { MailerService } from '../src/alerts/mailer.service';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/workspace';
import {
  DeliverAlertPayload,
  DeliverEmailPayload,
  JOBS,
  QUEUES,
} from '../src/jobs/jobs.types';
import { PrismaService } from '../src/prisma/prisma.service';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

describe('Alert flush (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const alertsQueue = (): Queue<DeliverAlertPayload | DeliverEmailPayload> =>
    app.get(getQueueToken(QUEUES.ALERTS), { strict: false });

  const pendingJobs = (): Promise<Job[]> =>
    alertsQueue().getJobs(['wait', 'paused', 'delayed']);

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailerService)
      .useValue({ enabled: true, send: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    await pauseQueues(app);

    prisma = app.get(PrismaService);
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
  });

  beforeEach(async () => {
    await obliterateQueues(app);
    await pauseQueues(app);
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "AlertEvent", "Webhook", "EmailAlert" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await obliterateQueues(app);
    await app.close();
  });

  const server = () => app.getHttpServer();

  const seedApp = async (
    name: string,
    isCompetitor = false,
    primaryAppId: string | null = null,
  ): Promise<string> => {
    const created = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: name,
        country: 'us',
        name,
        isCompetitor,
        primaryAppId,
      },
    });
    return created.id;
  };

  const seedEvent = async (
    event: string,
    appId: string | null,
    dedupeKey: string,
    payload: unknown,
  ): Promise<void> => {
    await prisma.alertEvent.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        event,
        appId,
        dedupeKey,
        payload: payload as object,
      },
    });
  };

  const rankPayload = (appId: string, to: number): RankDroppedPayload => ({
    event: 'rank.dropped',
    occurredAt: '2026-07-22T10:00:00.000Z',
    app: { id: appId, name: 'primary' },
    keyword: { id: 'kw1', text: 'game' },
    from: 3,
    to,
    threshold: 5,
  });

  it('flushes a day of events into one grouped job per subscribed channel', async () => {
    const primary = await seedApp('primary');
    const competitor = await seedApp('competitor', true, primary);

    await seedEvent(
      'rank.dropped',
      primary,
      `rank:${primary}:kw1:2026-07-22`,
      rankPayload(primary, 12),
    );
    await seedEvent(
      'metadata.changed',
      competitor,
      `change:${competitor}:title:2026-07-22`,
      {
        event: 'metadata.changed',
        occurredAt: '2026-07-22T10:00:00.000Z',
        app: { id: competitor, name: 'competitor', isCompetitor: true },
        changes: [{ field: 'title', before: 'x', after: 'y' }],
      } satisfies MetadataChangedPayload,
    );

    const webhook = await prisma.webhook.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        url: 'https://hooks.example.com/x',
        events: ['rank.dropped', 'metadata.changed'],
      },
    });
    const rankOnly = await prisma.webhook.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        url: 'https://hooks.example.com/rank',
        events: ['rank.dropped'],
      },
    });
    const reviewOnly = await prisma.webhook.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        url: 'https://hooks.example.com/review',
        events: ['review.negative'],
      },
    });
    await prisma.emailAlert.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        email: 'ops@example.com',
        events: ['rank.dropped', 'metadata.changed'],
      },
    });

    const response = await request(server()).post('/alerts/flush').expect(201);
    const result = response.body as AlertFlushResult;
    expect(result.flushed).toBe(2);
    expect(result.channels).toBe(3);

    const jobs = await pendingJobs();
    const webhookJobs = jobs.filter((job) => job.name === JOBS.DELIVER_ALERT);
    const emailJobs = jobs.filter((job) => job.name === JOBS.DELIVER_EMAIL);
    expect(webhookJobs).toHaveLength(2);
    expect(emailJobs).toHaveLength(1);

    const targets = webhookJobs.map(
      (job) => (job.data as DeliverAlertPayload).webhookId,
    );
    expect(targets).toContain(webhook.id);
    expect(targets).toContain(rankOnly.id);
    expect(targets).not.toContain(reviewOnly.id);

    const full = webhookJobs.find(
      (job) => (job.data as DeliverAlertPayload).webhookId === webhook.id,
    )!;
    const fullBatch = (full.data as DeliverAlertPayload)
      .payload as AlertBatchPayload;
    expect(fullBatch.event).toBe('alerts.batch');
    expect(fullBatch.apps).toHaveLength(1);
    expect(fullBatch.apps[0].rankDrops).toHaveLength(1);
    expect(fullBatch.apps[0].competitors).toHaveLength(1);

    const rankBatch = (
      webhookJobs.find(
        (job) => (job.data as DeliverAlertPayload).webhookId === rankOnly.id,
      )!.data as DeliverAlertPayload
    ).payload as AlertBatchPayload;
    expect(rankBatch.events.every((e) => e.event === 'rank.dropped')).toBe(
      true,
    );
    expect(rankBatch.apps[0].competitors).toHaveLength(0);

    const flushedRows = await prisma.alertEvent.count({
      where: { flushedAt: null },
    });
    expect(flushedRows).toBe(0);
  });

  it('deduplicates a repeated fact and keeps the latest values', async () => {
    const primary = await seedApp('primary');
    const key = `rank:${primary}:kw1:2026-07-22`;
    await seedEvent('rank.dropped', primary, key, rankPayload(primary, 12));
    await prisma.alertEvent.upsert({
      where: {
        workspaceId_dedupeKey: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          dedupeKey: key,
        },
      },
      create: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        event: 'rank.dropped',
        appId: primary,
        dedupeKey: key,
        payload: rankPayload(primary, 20),
      },
      update: { payload: rankPayload(primary, 20) },
    });
    await prisma.webhook.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        url: 'https://hooks.example.com/x',
        events: ['rank.dropped'],
      },
    });

    const response = await request(server()).post('/alerts/flush').expect(201);
    expect((response.body as AlertFlushResult).flushed).toBe(1);

    const jobs = await pendingJobs();
    const batch = (jobs[0].data as DeliverAlertPayload)
      .payload as AlertBatchPayload;
    const drop = batch.apps[0].rankDrops[0];
    expect(drop.to).toBe(20);
  });

  it('sends nothing when the outbox is empty', async () => {
    await prisma.webhook.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        url: 'https://hooks.example.com/x',
        events: ['rank.dropped'],
      },
    });

    const response = await request(server()).post('/alerts/flush').expect(201);
    expect(response.body as AlertFlushResult).toEqual({
      flushed: 0,
      channels: 0,
    });
    expect(await pendingJobs()).toHaveLength(0);
  });
});
