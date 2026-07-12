import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Store } from '@prisma/client';
import { ApiErrorEnvelope, CategoryRankSeries } from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { obliterateQueues } from './obliterate-queues';
import { DEFAULT_WORKSPACE_ID } from '../src/common/workspace';
import { PrismaService } from '../src/prisma/prisma.service';

describe('CategoryRanksController (e2e)', () => {
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
      .get('/apps/missing/category-ranks')
      .expect(404);

    const body = response.body as ApiErrorEnvelope;
    expect(body.statusCode).toBe(404);
    expect(body.path).toBe('/apps/missing/category-ranks');
    expect(typeof body.message).toBe('string');
  });

  it('groups category rank history by collection and genre', async () => {
    const you = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: 'self-store',
        country: 'us',
        name: 'You',
        snapshots: {
          create: {
            title: 'You',
            description: 'desc',
            raw: {
              primaryGenreId: 6007,
              primaryGenre: 'Productivity',
              price: 0,
            },
          },
        },
      },
    });
    await prisma.categoryRank.createMany({
      data: [
        {
          appId: you.id,
          date: new Date('2026-07-09T00:00:00.000Z'),
          collection: 'free',
          genreId: 6007,
          position: 12,
        },
        {
          appId: you.id,
          date: new Date('2026-07-10T00:00:00.000Z'),
          collection: 'free',
          genreId: 6007,
          position: 8,
        },
        {
          appId: you.id,
          date: new Date('2026-07-10T00:00:00.000Z'),
          collection: 'free',
          genreId: 0,
          position: null,
        },
      ],
    });

    const response = await request(app.getHttpServer())
      .get(`/apps/${you.id}/category-ranks`)
      .expect(200);

    const body = response.body as CategoryRankSeries;
    expect(body.series).toHaveLength(2);
    const category = body.series.find((item) => item.genreId === 6007);
    expect(category).toMatchObject({
      collection: 'free',
      genreName: 'Productivity',
      current: 8,
    });
    expect(category?.points).toHaveLength(2);
    const overall = body.series.find((item) => item.genreId === 0);
    expect(overall).toMatchObject({ genreName: 'Overall', current: null });
  });
});
