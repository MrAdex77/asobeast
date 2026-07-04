import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Store } from '@prisma/client';
import {
  AppDetail,
  KeywordFieldResult,
  KeywordSuggestion,
  TrackedKeywordItem,
} from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/workspace';
import { PrismaService } from '../src/prisma/prisma.service';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { NormalizedApp, StoreProvider } from '../src/store-providers/types';

const FIXTURE: NormalizedApp = {
  store: Store.APP_STORE,
  storeAppId: '1234567890',
  title: 'Habit Tracker',
  subtitle: 'Daily streak counter',
  summary: 'A markdown journal',
  description: 'Fixture description',
  raw: { source: 'fixture' },
};

const APP_STORE_URL = 'https://apps.apple.com/us/app/fixture/id1234567890';

class FakeRegistry {
  get(store: Store): StoreProvider {
    return {
      store,
      getApp: () => Promise.resolve(FIXTURE),
      search: () => Promise.resolve([]),
      suggest: () =>
        Promise.resolve([
          { term: 'productivity', priority: 6000 },
          { term: 'habit tracker app', priority: 8000 },
          { term: 'habit', priority: 9000 },
        ]),
      similar: () =>
        Promise.resolve([
          { storeAppId: '1', title: 'Streak Master Planner' },
          { storeAppId: '2', title: 'Daily Planner Pro' },
        ]),
    };
  }
}

describe('KeywordsController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const importApp = async (): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/apps')
      .send({ url: APP_STORE_URL })
      .expect(201);
    return (response.body as AppDetail).id;
  };

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StoreProviderRegistry)
      .useValue(new FakeRegistry())
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
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
    await app.close();
  });

  it('auto tracks title and subtitle keywords but not description', async () => {
    const id = await importApp();

    const response = await request(app.getHttpServer())
      .get(`/apps/${id}/keywords`)
      .expect(200);
    const items = response.body as TrackedKeywordItem[];

    const bySource = (source: string) =>
      items.filter((item) => item.source === source).map((item) => item.text);

    expect(bySource('TITLE')).toContain('habit');
    expect(bySource('SUBTITLE')).toContain('streak');
    expect(items.some((item) => item.source === 'DESCRIPTION')).toBe(false);
    for (const item of items) {
      expect(item.latestPosition).toBeNull();
      expect(item.opportunity).toBeNull();
    }
  });

  it('adds, toggles and removes manual keywords', async () => {
    const id = await importApp();

    const added = await request(app.getHttpServer())
      .post(`/apps/${id}/keywords`)
      .send({ keywords: ['Habit Builder', 'streak counter'] })
      .expect(201);
    const manual = (added.body as TrackedKeywordItem[]).find(
      (item) => item.text === 'habit builder',
    );
    expect(manual).toBeDefined();
    expect(manual?.source).toBe('MANUAL');

    await request(app.getHttpServer())
      .patch(`/apps/${id}/keywords/${manual?.keywordId}`)
      .send({ active: false })
      .expect(200);

    const afterToggle = await request(app.getHttpServer())
      .get(`/apps/${id}/keywords`)
      .expect(200);
    expect(
      (afterToggle.body as TrackedKeywordItem[]).find(
        (item) => item.keywordId === manual?.keywordId,
      )?.active,
    ).toBe(false);

    await request(app.getHttpServer())
      .delete(`/apps/${id}/keywords/${manual?.keywordId}`)
      .expect(204);

    const afterDelete = await request(app.getHttpServer())
      .get(`/apps/${id}/keywords`)
      .expect(200);
    expect(
      (afterDelete.body as TrackedKeywordItem[]).some(
        (item) => item.keywordId === manual?.keywordId,
      ),
    ).toBe(false);
    expect(
      await prisma.keyword.count({ where: { text: 'habit builder' } }),
    ).toBe(1);
  });

  it('round trips the ios keyword field with character accounting', async () => {
    const id = await importApp();

    const first = await request(app.getHttpServer())
      .put(`/apps/${id}/keyword-field`)
      .send({ text: 'habit,tracker,streak,habit' })
      .expect(200);
    const firstBody = first.body as KeywordFieldResult;

    expect(firstBody.charactersLimit).toBe(100);
    expect(firstBody.duplicatesRemoved).toBe(1);
    expect(firstBody.charactersUsed).toBe('habit,tracker,streak'.length);
    expect(firstBody.tracked.map((item) => item.text).sort()).toEqual([
      'habit',
      'streak',
      'tracker',
    ]);
    for (const item of firstBody.tracked) {
      expect(item.source).toBe('KEYWORD_FIELD');
      expect(item.active).toBe(true);
    }

    const second = await request(app.getHttpServer())
      .put(`/apps/${id}/keyword-field`)
      .send({ text: 'habit,goals' })
      .expect(200);
    const secondBody = second.body as KeywordFieldResult;

    expect(secondBody.tracked.map((item) => item.text).sort()).toEqual([
      'goals',
      'habit',
    ]);

    const deactivated = await prisma.trackedKeyword.findMany({
      where: { appId: id, source: 'KEYWORD_FIELD', active: false },
      include: { keyword: true },
    });
    expect(deactivated.map((row) => row.keyword.text).sort()).toEqual([
      'streak',
      'tracker',
    ]);
  });

  it('suggests untracked metadata candidates by default', async () => {
    const id = await importApp();

    const response = await request(app.getHttpServer())
      .get(`/apps/${id}/keywords/suggestions`)
      .expect(200);
    const suggestions = response.body as KeywordSuggestion[];
    const texts = suggestions.map((item) => item.text);

    expect(suggestions.every((item) => item.strategy === 'metadata')).toBe(
      true,
    );
    expect(texts).toContain('markdown');
    expect(texts).not.toContain('habit');
  });

  it('suggests autocomplete terms with priority for the search strategy', async () => {
    const id = await importApp();

    const response = await request(app.getHttpServer())
      .get(`/apps/${id}/keywords/suggestions`)
      .query({ strategy: 'search' })
      .expect(200);
    const suggestions = response.body as KeywordSuggestion[];

    const productivity = suggestions.find(
      (item) => item.text === 'productivity',
    );
    expect(productivity?.strategy).toBe('search');
    expect(productivity?.priority).toBe(6000);
    expect(suggestions.some((item) => item.text === 'habit')).toBe(false);
  });

  it('suggests common terms from similar apps with usedByCount', async () => {
    const id = await importApp();

    const response = await request(app.getHttpServer())
      .get(`/apps/${id}/keywords/suggestions`)
      .query({ strategy: 'similar' })
      .expect(200);
    const suggestions = response.body as KeywordSuggestion[];

    const planner = suggestions.find((item) => item.text === 'planner');
    expect(planner?.strategy).toBe('similar');
    expect(planner?.usedByCount).toBe(2);
  });

  it('rejects empty and overly long keyword phrases', async () => {
    const id = await importApp();

    await request(app.getHttpServer())
      .post(`/apps/${id}/keywords`)
      .send({ keywords: ['   '] })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/apps/${id}/keywords`)
      .send({ keywords: ['one two three four five six'] })
      .expect(400);
  });
});
