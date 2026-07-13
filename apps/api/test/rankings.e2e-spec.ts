import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Store } from '@prisma/client';
import { ApiErrorEnvelope, SerpMovers } from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { obliterateQueues } from './obliterate-queues';
import { DEFAULT_WORKSPACE_ID } from '../src/common/workspace';
import { PrismaService } from '../src/prisma/prisma.service';

function utcMidnight(offsetDays: number): Date {
  const now = new Date();
  const date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  date.setUTCDate(date.getUTCDate() - offsetDays);
  return date;
}

describe('RankingsController serp-movers (e2e)', () => {
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

  it('returns a 404 envelope for an unknown app id', async () => {
    const response = await request(app.getHttpServer())
      .get('/apps/missing/serp-movers')
      .expect(404);

    const body = response.body as ApiErrorEnvelope;
    expect(body.statusCode).toBe(404);
    expect(body.path).toBe('/apps/missing/serp-movers');
    expect(typeof body.message).toBe('string');
  });

  it('lists entrants excluding the first day and annotates known apps', async () => {
    const you = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: 'self-store',
        country: 'us',
        name: 'You',
      },
    });
    const rival = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: 'rival-store',
        country: 'us',
        name: 'Rival',
        isCompetitor: true,
        primaryAppId: you.id,
      },
    });
    const keyword = await prisma.keyword.create({
      data: { text: 'habit tracker', store: Store.APP_STORE, country: 'us' },
    });
    await prisma.trackedKeyword.create({
      data: {
        appId: you.id,
        keywordId: keyword.id,
        source: 'MANUAL',
        active: true,
      },
    });

    const day1 = utcMidnight(1);
    const day2 = utcMidnight(0);
    await prisma.serpEntry.createMany({
      data: [
        {
          keywordId: keyword.id,
          date: day1,
          position: 1,
          storeAppId: 'self-store',
          title: 'You',
        },
        {
          keywordId: keyword.id,
          date: day2,
          position: 1,
          storeAppId: 'self-store',
          title: 'You',
        },
        {
          keywordId: keyword.id,
          date: day2,
          position: 2,
          storeAppId: 'rival-store',
          title: 'Rival',
        },
        {
          keywordId: keyword.id,
          date: day2,
          position: 3,
          storeAppId: 'stranger-store',
          title: 'Stranger',
        },
      ],
    });

    const response = await request(app.getHttpServer())
      .get(`/apps/${you.id}/serp-movers?days=30`)
      .expect(200);

    const body = response.body as SerpMovers;
    expect(body.windowDays).toBe(30);
    expect(body.items).toHaveLength(2);
    expect(body.items.map((item) => item.storeAppId)).toEqual([
      'rival-store',
      'stranger-store',
    ]);
    expect(body.items[0]).toMatchObject({
      date: day2.toISOString().slice(0, 10),
      position: 2,
      appId: rival.id,
      isCompetitor: true,
      text: 'habit tracker',
    });
    expect(body.items[1]).toMatchObject({
      appId: null,
      isCompetitor: false,
    });
  });
});
