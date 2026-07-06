import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Store } from '@prisma/client';
import { AppSummary, VisibilityHistory } from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { obliterateQueues } from './obliterate-queues';
import { DEFAULT_WORKSPACE_ID } from '../src/common/workspace';
import { PrismaService } from '../src/prisma/prisma.service';

const D0 = new Date('2026-06-30T00:00:00.000Z');
const D7 = new Date('2026-06-23T00:00:00.000Z');

interface Seeded {
  keywordId: string;
  text: string;
  ranks: Array<{ date: Date; position: number | null }>;
  traffic: number;
  difficulty: number;
}

describe('AnalyticsController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await obliterateQueues(app);
    await app.close();
  });

  const seed = async (): Promise<string> => {
    const app = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '1234567890',
        country: 'us',
        name: 'Habit Tracker',
      },
    });

    await prisma.appSnapshot.create({
      data: {
        appId: app.id,
        title: 'Habit Tracker',
        subtitle: 'Daily streak counter',
        description: 'Build habits every day',
        raw: {},
        capturedAt: D0,
      },
    });

    const keywords: Seeded[] = [
      {
        keywordId: '',
        text: 'habit tracker',
        traffic: 8,
        difficulty: 3,
        ranks: [
          { date: D7, position: 24 },
          { date: D0, position: 11 },
        ],
      },
      {
        keywordId: '',
        text: 'streak app',
        traffic: 5,
        difficulty: 4,
        ranks: [
          { date: D7, position: 6 },
          { date: D0, position: 14 },
        ],
      },
      {
        keywordId: '',
        text: 'daily goals',
        traffic: 8,
        difficulty: 2,
        ranks: [],
      },
      {
        keywordId: '',
        text: 'habit',
        traffic: 9,
        difficulty: 5,
        ranks: [
          { date: D7, position: 2 },
          { date: D0, position: 1 },
        ],
      },
    ];

    for (const kw of keywords) {
      const keyword = await prisma.keyword.create({
        data: { text: kw.text, store: Store.APP_STORE, country: 'us' },
      });
      await prisma.trackedKeyword.create({
        data: {
          appId: app.id,
          keywordId: keyword.id,
          source: 'MANUAL',
          active: true,
        },
      });
      await prisma.keywordMetric.create({
        data: {
          keywordId: keyword.id,
          date: D7,
          traffic: kw.traffic,
          difficulty: kw.difficulty,
        },
      });
      for (const rank of kw.ranks) {
        await prisma.keywordRanking.create({
          data: {
            appId: app.id,
            keywordId: keyword.id,
            date: rank.date,
            position: rank.position,
            depth: 100,
          },
        });
      }
    }

    return app.id;
  };

  it('computes every summary block from seeded rows', async () => {
    const id = await seed();

    const response = await request(app.getHttpServer())
      .get(`/apps/${id}/summary`)
      .expect(200);
    const summary = response.body as AppSummary;

    expect(summary.visibility.current).toBeCloseTo(41.7, 1);
    expect(summary.visibility.delta7d).toBeCloseTo(11.1, 1);
    expect(summary.visibility.delta30d).toBeNull();

    expect(summary.rankDistribution).toEqual({
      top1: 1,
      top3: 1,
      top10: 1,
      top50: 3,
      beyond: 0,
      unranked: 1,
    });

    expect(summary.movers.up[0]).toMatchObject({
      text: 'habit tracker',
      from: 24,
      to: 11,
    });
    expect(summary.movers.down[0]).toMatchObject({
      text: 'streak app',
      from: 6,
      to: 14,
    });

    expect(summary.coverage.inTitle).toBe(2);
    expect(summary.coverage.inSubtitle).toBe(0);
    expect(summary.coverage.inDescription).toBe(0);
    expect(
      summary.coverage.uncoveredHighOpportunity.map((item) => item.text),
    ).toContain('daily goals');

    expect(summary.trackedKeywords).toBe(4);
    expect(summary.competitors).toBe(0);
    expect(summary.lastRefreshAt).toBe(D0.toISOString());
  });

  it('returns a history whose last point matches current visibility', async () => {
    const id = await seed();

    const summaryResponse = await request(app.getHttpServer())
      .get(`/apps/${id}/summary`)
      .expect(200);
    const current = (summaryResponse.body as AppSummary).visibility.current;

    const response = await request(app.getHttpServer())
      .get(`/apps/${id}/visibility-history`)
      .query({ from: '2026-06-20', to: '2026-07-01' })
      .expect(200);
    const history = response.body as VisibilityHistory;

    expect(history.points.map((point) => point.date)).toEqual([
      '2026-06-23',
      '2026-06-30',
    ]);
    const last = history.points[history.points.length - 1];
    expect(last.date).toBe('2026-06-30');
    expect(last.visibility).toBeCloseTo(current, 1);
  });

  it('rejects ranges beyond the 180 day cap', async () => {
    const id = await seed();

    await request(app.getHttpServer())
      .get(`/apps/${id}/visibility-history`)
      .query({ from: '2025-01-01', to: '2026-07-01' })
      .expect(400);
  });
});
