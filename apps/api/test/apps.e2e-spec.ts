import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Store } from '@prisma/client';
import { ApiErrorEnvelope, AppDetail } from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { obliterateQueues } from './obliterate-queues';
import { DEFAULT_WORKSPACE_ID } from '../src/common/workspace';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  StoreNotSupportedError,
  StoreRequestError,
} from '../src/store-providers/errors';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { NormalizedApp, StoreProvider } from '../src/store-providers/types';

const APP_STORE_FIXTURE: NormalizedApp = {
  store: Store.APP_STORE,
  storeAppId: '1234567890',
  title: 'Fixture App',
  subtitle: 'Fixture subtitle',
  summary: 'Fixture summary',
  description: 'Fixture description',
  iconUrl: 'https://example.com/icon.png',
  ratingAvg: 4.5,
  ratingCount: 1234,
  price: 0,
  version: '1.0.0',
  releasedAt: new Date('2020-01-01T00:00:00Z'),
  storeUpdatedAt: new Date('2021-01-01T00:00:00Z'),
  raw: { source: 'fixture' },
};

const APP_STORE_URL = 'https://apps.apple.com/us/app/fixture/id1234567890';
const GOOGLE_PLAY_URL =
  'https://play.google.com/store/apps/details?id=com.example.app';

class FakeStoreProviderRegistry {
  failWith: Error | null = null;
  getAppCalls: Array<{ storeAppId: string; country: string }> = [];

  get(store: Store): StoreProvider {
    if (store === Store.GOOGLE_PLAY) {
      return this.buildProvider(store, () =>
        Promise.reject(new StoreNotSupportedError(store)),
      );
    }
    return this.buildProvider(Store.APP_STORE, (storeAppId, country) => {
      this.getAppCalls.push({ storeAppId, country });
      return this.failWith
        ? Promise.reject(this.failWith)
        : Promise.resolve({ ...APP_STORE_FIXTURE, storeAppId });
    });
  }

  private buildProvider(
    store: Store,
    getApp: (storeAppId: string, country: string) => Promise<NormalizedApp>,
  ): StoreProvider {
    return {
      store,
      getApp,
      search: () => Promise.resolve([]),
      suggest: () => Promise.resolve([]),
      similar: () => Promise.resolve([]),
    };
  }
}

describe('AppsController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const registry = new FakeStoreProviderRegistry();

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
      .useValue(registry)
      .compile();

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
    registry.failWith = null;
    registry.getAppCalls = [];
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await obliterateQueues(app);
    await app.close();
  });

  it('imports an app and creates an initial snapshot', async () => {
    const response = await request(app.getHttpServer())
      .post('/apps')
      .send({ url: APP_STORE_URL })
      .expect(201);
    const body = response.body as AppDetail;

    expect(body.store).toBe('APP_STORE');
    expect(body.storeAppId).toBe('1234567890');
    expect(body.country).toBe('us');
    expect(body.latestSnapshot?.title).toBe('Fixture App');

    expect(await prisma.app.count()).toBe(1);
    expect(await prisma.appSnapshot.count()).toBe(1);
  });

  it('is idempotent when reimporting the same url', async () => {
    const first = await request(app.getHttpServer())
      .post('/apps')
      .send({ url: APP_STORE_URL })
      .expect(201);
    const second = await request(app.getHttpServer())
      .post('/apps')
      .send({ url: APP_STORE_URL })
      .expect(201);

    expect((second.body as AppDetail).id).toBe((first.body as AppDetail).id);
    expect(await prisma.app.count()).toBe(1);
    expect(await prisma.appSnapshot.count()).toBe(2);
  });

  it('honors the country in the store url', async () => {
    const response = await request(app.getHttpServer())
      .post('/apps')
      .send({ url: 'https://apps.apple.com/de/app/fixture/id1234567890' })
      .expect(201);

    expect((response.body as AppDetail).country).toBe('de');
    expect(registry.getAppCalls).toContainEqual({
      storeAppId: '1234567890',
      country: 'de',
    });
  });

  it('lets an explicit country override the url', async () => {
    const response = await request(app.getHttpServer())
      .post('/apps')
      .send({
        url: 'https://apps.apple.com/de/app/fixture/id1234567890',
        country: 'fr',
      })
      .expect(201);

    expect((response.body as AppDetail).country).toBe('fr');
  });

  it('returns a 400 envelope for an invalid country code', async () => {
    const response = await request(app.getHttpServer())
      .post('/apps')
      .send({ url: APP_STORE_URL, country: 'deu' })
      .expect(400);

    expectEnvelope(response.body as ApiErrorEnvelope, 400, '/apps');
  });

  it('imports the same app in a new country as a separate row', async () => {
    await request(app.getHttpServer())
      .post('/apps')
      .send({ url: APP_STORE_URL })
      .expect(201);
    await request(app.getHttpServer())
      .post('/apps')
      .send({ url: 'https://apps.apple.com/de/app/fixture/id1234567890' })
      .expect(201);

    expect(await prisma.app.count()).toBe(2);
  });

  it('captures competitors with the primary app country', async () => {
    const primary = await request(app.getHttpServer())
      .post('/apps')
      .send({ url: 'https://apps.apple.com/de/app/fixture/id1234567890' })
      .expect(201);
    registry.getAppCalls = [];

    await request(app.getHttpServer())
      .post(`/apps/${(primary.body as AppDetail).id}/competitors`)
      .send({ url: 'https://apps.apple.com/gb/app/rival/id9876543210' })
      .expect(201);

    expect(registry.getAppCalls).toContainEqual({
      storeAppId: '9876543210',
      country: 'de',
    });
  });

  const expectEnvelope = (
    body: ApiErrorEnvelope,
    statusCode: number,
    path: string,
  ): void => {
    expect(body.statusCode).toBe(statusCode);
    expect(typeof body.error).toBe('string');
    expect(typeof body.message).toBe('string');
    expect(body.path).toBe(path);
    expect(typeof body.timestamp).toBe('string');
  };

  it('returns a 400 envelope for a malformed body', async () => {
    const response = await request(app.getHttpServer())
      .post('/apps')
      .send({ url: 42, extra: 'nope' })
      .expect(400);

    expectEnvelope(response.body as ApiErrorEnvelope, 400, '/apps');
  });

  it('returns a 404 envelope for an unknown app id', async () => {
    const response = await request(app.getHttpServer())
      .get('/apps/00000000-0000-0000-0000-000000000000')
      .expect(404);

    expectEnvelope(
      response.body as ApiErrorEnvelope,
      404,
      '/apps/00000000-0000-0000-0000-000000000000',
    );
  });

  it('returns a 501 envelope for a Google Play url', async () => {
    const response = await request(app.getHttpServer())
      .post('/apps')
      .send({ url: GOOGLE_PLAY_URL })
      .expect(501);
    const body = response.body as ApiErrorEnvelope;

    expectEnvelope(body, 501, '/apps');
    expect(body.message).toBe(
      'Google Play support is planned; asobeast currently tracks App Store apps only',
    );
  });

  it('returns a 400 envelope for an invalid url', async () => {
    const response = await request(app.getHttpServer())
      .post('/apps')
      .send({ url: 'not-a-store-url' })
      .expect(400);

    expectEnvelope(response.body as ApiErrorEnvelope, 400, '/apps');
  });

  it('returns a 502 envelope when the store request fails', async () => {
    registry.failWith = new StoreRequestError(
      Store.APP_STORE,
      'getApp',
      'boom',
    );

    const response = await request(app.getHttpServer())
      .post('/apps')
      .send({ url: APP_STORE_URL })
      .expect(502);
    const body = response.body as ApiErrorEnvelope;

    expectEnvelope(body, 502, '/apps');
    expect(body.message).toContain('boom');
  });

  it('deletes an app and cascades its snapshots', async () => {
    const imported = await request(app.getHttpServer())
      .post('/apps')
      .send({ url: APP_STORE_URL })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/apps/${(imported.body as AppDetail).id}`)
      .expect(204);

    expect(await prisma.app.count()).toBe(0);
    expect(await prisma.appSnapshot.count()).toBe(0);
  });
});
