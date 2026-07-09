import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Store } from '@prisma/client';
import { AppAuditResult } from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { obliterateQueues } from './obliterate-queues';
import { DEFAULT_WORKSPACE_ID } from '../src/common/workspace';
import { PrismaService } from '../src/prisma/prisma.service';

const D0 = new Date('2026-07-01T00:00:00.000Z');

const factor = (result: AppAuditResult, id: string) =>
  result.factors.find((item) => item.id === id);

describe('AuditController (e2e)', () => {
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
    const created = await prisma.app.create({
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
        appId: created.id,
        title: 'Habit Tracker',
        subtitle: 'Daily Streak Counter',
        description:
          'Build better habits every single day.\n- Loved by 1 million users. Download now to start today.',
        ratingAvg: 4.6,
        ratingCount: 5000,
        storeUpdatedAt: new Date(),
        raw: {
          screenshots: Array.from({ length: 8 }, (_, i) => `s${i}.png`),
          releaseNotes: 'Bug fixes and improvements.',
        },
        capturedAt: D0,
      },
    });

    const keywords = [
      { text: 'habit tracker', traffic: 8, difficulty: 3, position: 4 },
      { text: 'streak counter', traffic: 6, difficulty: 4, position: 12 },
      { text: 'daily goals', traffic: 7, difficulty: 2, position: null },
    ];
    for (const kw of keywords) {
      const keyword = await prisma.keyword.create({
        data: { text: kw.text, store: Store.APP_STORE, country: 'us' },
      });
      await prisma.trackedKeyword.create({
        data: {
          appId: created.id,
          keywordId: keyword.id,
          source: 'MANUAL',
          active: true,
        },
      });
      await prisma.keywordMetric.create({
        data: {
          keywordId: keyword.id,
          date: D0,
          traffic: kw.traffic,
          difficulty: kw.difficulty,
        },
      });
      await prisma.keywordRanking.create({
        data: {
          appId: created.id,
          keywordId: keyword.id,
          date: D0,
          position: kw.position,
          depth: 100,
        },
      });
    }

    return created.id;
  };

  it('returns the ten factor score card with ported weights', async () => {
    const id = await seed();

    const response = await request(app.getHttpServer())
      .get(`/apps/${id}/audit`)
      .expect(200);
    const result = response.body as AppAuditResult;

    expect(result.factors).toHaveLength(10);
    expect(factor(result, 'title')?.weight).toBe(20);
    expect(result.totalWeight).toBe(110);
    expect(result.overall).not.toBeNull();

    const ratings = factor(result, 'ratings');
    expect(ratings?.score).toBeCloseTo(6.7, 1);

    expect(factor(result, 'keywordField')?.needsInput).toBe(true);
    expect(factor(result, 'keywordField')?.score).toBeNull();
  });

  it('persists manual answers and raises the overall', async () => {
    const id = await seed();

    const before = (
      await request(app.getHttpServer()).get(`/apps/${id}/audit`).expect(200)
    ).body as AppAuditResult;

    const after = (
      await request(app.getHttpServer())
        .put(`/apps/${id}/audit/inputs`)
        .send({
          screenshotsFirst3Compelling: true,
          screenshotsTextOverlays: true,
          screenshotsConsistent: true,
          screenshotsLocalized: true,
          screenshotsDeviceFrames: true,
          previewVideoExists: true,
          previewVideoHook: true,
          previewVideoLength: true,
          previewVideoWorksWithoutSound: true,
          iconDistinctive: true,
          iconSimple: true,
          iconCategoryFit: true,
          iconNoText: true,
        })
        .expect(200)
    ).body as AppAuditResult;

    expect(factor(after, 'previewVideo')?.needsInput).toBe(false);
    expect(factor(after, 'icon')?.score).toBe(10);
    expect((after.overall as number) > (before.overall as number)).toBe(true);

    const reloaded = (
      await request(app.getHttpServer()).get(`/apps/${id}/audit`).expect(200)
    ).body as AppAuditResult;
    expect(factor(reloaded, 'icon')?.score).toBe(10);
  });

  it('rejects unknown input keys', async () => {
    const id = await seed();
    await request(app.getHttpServer())
      .put(`/apps/${id}/audit/inputs`)
      .send({ notARealAnswer: true })
      .expect(400);
  });

  it('returns 404 for an unknown app and 501 for Google Play', async () => {
    await request(app.getHttpServer()).get('/apps/missing/audit').expect(404);

    const gplay = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.GOOGLE_PLAY,
        storeAppId: 'com.example.app',
        country: 'us',
        name: 'Play App',
      },
    });
    await request(app.getHttpServer())
      .get(`/apps/${gplay.id}/audit`)
      .expect(501);
  });
});
