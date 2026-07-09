import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Store } from '@prisma/client';
import { CompetitorAnalysis } from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { obliterateQueues } from './obliterate-queues';
import { DEFAULT_WORKSPACE_ID } from '../src/common/workspace';
import { PrismaService } from '../src/prisma/prisma.service';

const D0 = new Date('2026-07-01T00:00:00.000Z');

describe('CompetitorsController (e2e)', () => {
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
    const primary = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '111',
        country: 'us',
        name: 'Habit Tracker',
      },
    });
    const competitor = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '222',
        country: 'us',
        name: 'Streak Master',
        isCompetitor: true,
        primaryAppId: primary.id,
      },
    });
    for (const target of [
      {
        id: primary.id,
        title: 'Habit Tracker',
        subtitle: 'Daily Counter',
        rating: 4.7,
      },
      {
        id: competitor.id,
        title: 'Streak Master',
        subtitle: 'Habit Coach',
        rating: 4.2,
      },
    ]) {
      await prisma.appSnapshot.create({
        data: {
          appId: target.id,
          title: target.title,
          subtitle: target.subtitle,
          description: 'desc',
          ratingAvg: target.rating,
          raw: {},
          capturedAt: D0,
        },
      });
    }

    const rows = [
      { text: 'habit tracker', you: null, them: 5 },
      { text: 'streak counter', you: 3, them: null },
      { text: 'daily goals', you: 20, them: 5 },
      { text: 'sleep timer', you: 2, them: 8 },
    ];
    for (const row of rows) {
      const keyword = await prisma.keyword.create({
        data: { text: row.text, store: Store.APP_STORE, country: 'us' },
      });
      await prisma.trackedKeyword.create({
        data: {
          appId: primary.id,
          keywordId: keyword.id,
          source: 'MANUAL',
          active: true,
        },
      });
      await prisma.keywordMetric.create({
        data: { keywordId: keyword.id, date: D0, traffic: 7, difficulty: 3 },
      });
      await prisma.keywordRanking.create({
        data: {
          appId: primary.id,
          keywordId: keyword.id,
          date: D0,
          position: row.you,
          depth: 100,
        },
      });
      await prisma.keywordRanking.create({
        data: {
          appId: competitor.id,
          keywordId: keyword.id,
          date: D0,
          position: row.them,
          depth: 100,
        },
      });
    }
    return primary.id;
  };

  it('returns the three gap tables and the position map', async () => {
    const id = await seed();

    const response = await request(app.getHttpServer())
      .get(`/apps/${id}/competitors/analysis`)
      .expect(200);
    const analysis = response.body as CompetitorAnalysis;

    expect(analysis.gaps.theyRankYouDont.map((k) => k.text)).toEqual([
      'habit tracker',
    ]);
    expect(analysis.gaps.youRankTheyDont.map((k) => k.text)).toEqual([
      'streak counter',
    ]);

    const outranked = analysis.gaps.outranked.find(
      (k) => k.text === 'daily goals',
    );
    expect(outranked?.yourPosition).toBe(20);
    expect(outranked?.bestCompetitorPosition).toBe(5);
    expect(outranked?.gap).toBe(15);

    expect(analysis.metadataComparison).toHaveLength(2);
    const you = analysis.positionMap.find((p) => p.isYou);
    expect(you?.name).toBe('Habit Tracker');
    expect(analysis.positionMap).toHaveLength(2);
  });
});
