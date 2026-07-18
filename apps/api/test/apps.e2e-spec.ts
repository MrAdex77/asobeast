import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Store } from '@prisma/client';
import {
  ApiErrorEnvelope,
  AppDetail,
  AppGroupSummary,
  MarketAvailability,
  MarketAvailabilityResult,
} from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { obliterateQueues, pauseQueues } from './obliterate-queues';
import { DEFAULT_WORKSPACE_ID } from '../src/common/workspace';
import { PrismaService } from '../src/prisma/prisma.service';
import { StoreRequestError } from '../src/store-providers/errors';
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

const GOOGLE_PLAY_FIXTURE: NormalizedApp = {
  store: Store.GOOGLE_PLAY,
  storeAppId: 'com.example.app',
  title: 'Play Fixture',
  subtitle: undefined,
  summary: 'Play fixture short description',
  description: 'Play fixture description',
  iconUrl: 'https://example.com/play-icon.png',
  ratingAvg: 4.2,
  ratingCount: 4321,
  installs: 1000000n,
  price: 0,
  version: '2.0.0',
  releasedAt: new Date('2021-06-01T00:00:00Z'),
  storeUpdatedAt: new Date('2022-01-01T00:00:00Z'),
  raw: { source: 'fixture', genreId: 'TOOLS', recentChanges: 'Bug fixes' },
};

const APP_STORE_URL = 'https://apps.apple.com/us/app/fixture/id1234567890';
const GOOGLE_PLAY_URL =
  'https://play.google.com/store/apps/details?id=com.example.app';

class FakeStoreProviderRegistry {
  failWith: Error | null = null;
  getAppCalls: Array<{ storeAppId: string; country: string }> = [];
  availabilityCalls: Array<{ storeAppId: string; countries: string[] }> = [];
  availabilityStatus: MarketAvailability = 'available';

  get(store: Store): StoreProvider {
    if (store === Store.GOOGLE_PLAY) {
      return this.buildProvider(store, (storeAppId, country) => {
        this.getAppCalls.push({ storeAppId, country });
        return this.failWith
          ? Promise.reject(this.failWith)
          : Promise.resolve({ ...GOOGLE_PLAY_FIXTURE, storeAppId });
      });
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
      availability: (storeAppId: string, countries: string[]) => {
        this.availabilityCalls.push({ storeAppId, countries });
        return Promise.resolve(
          countries.map((country) => ({
            country,
            status: this.availabilityStatus,
          })),
        );
      },
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
    await pauseQueues(app);

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
    registry.availabilityCalls = [];
    registry.availabilityStatus = 'available';
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword", "AppGroup" RESTART IDENTITY CASCADE',
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

  it('imports a Google Play app with summary and installs', async () => {
    const response = await request(app.getHttpServer())
      .post('/apps')
      .send({ url: `${GOOGLE_PLAY_URL}&gl=de` })
      .expect(201);
    const body = response.body as AppDetail;

    expect(body.store).toBe('GOOGLE_PLAY');
    expect(body.storeAppId).toBe('com.example.app');
    expect(body.country).toBe('de');
    expect(body.latestSnapshot?.title).toBe('Play Fixture');
    expect(body.latestSnapshot?.summary).toBe('Play fixture short description');
    expect(body.latestSnapshot?.installs).toBe(1000000);

    expect(registry.getAppCalls).toContainEqual({
      storeAppId: 'com.example.app',
      country: 'de',
    });
    expect(await prisma.appSnapshot.count()).toBe(1);
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

  const importApp = async (url: string): Promise<AppDetail> => {
    const response = await request(app.getHttpServer())
      .post('/apps')
      .send({ url })
      .expect(201);
    return response.body as AppDetail;
  };

  it('links an app store and google play app into one group', async () => {
    const apple = await importApp(APP_STORE_URL);
    const play = await importApp(GOOGLE_PLAY_URL);

    const link = await request(app.getHttpServer())
      .post(`/apps/${apple.id}/link`)
      .send({ appId: play.id })
      .expect(201);
    const group = link.body as AppGroupSummary;

    expect(group.members).toHaveLength(2);
    expect(group.members[0].store).toBe('APP_STORE');
    expect(group.members[1].store).toBe('GOOGLE_PLAY');

    const appleDetail = await request(app.getHttpServer())
      .get(`/apps/${apple.id}`)
      .expect(200);
    const playDetail = await request(app.getHttpServer())
      .get(`/apps/${play.id}`)
      .expect(200);
    expect((appleDetail.body as AppDetail).group?.id).toBe(group.id);
    expect((playDetail.body as AppDetail).group?.id).toBe(group.id);
  });

  it('rejects linking two apps on the same store', async () => {
    const apple = await importApp(APP_STORE_URL);
    const otherApple = await importApp(
      'https://apps.apple.com/us/app/rival/id9876543210',
    );

    const response = await request(app.getHttpServer())
      .post(`/apps/${apple.id}/link`)
      .send({ appId: otherApple.id })
      .expect(400);

    expectEnvelope(
      response.body as ApiErrorEnvelope,
      400,
      `/apps/${apple.id}/link`,
    );
  });

  it('rejects linking apps that are already grouped', async () => {
    const apple = await importApp(APP_STORE_URL);
    const play = await importApp(GOOGLE_PLAY_URL);
    const otherApple = await importApp(
      'https://apps.apple.com/us/app/rival/id9876543210',
    );
    const otherPlay = await importApp(
      'https://play.google.com/store/apps/details?id=com.example.other',
    );

    await request(app.getHttpServer())
      .post(`/apps/${apple.id}/link`)
      .send({ appId: play.id })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/apps/${otherApple.id}/link`)
      .send({ appId: otherPlay.id })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post(`/apps/${apple.id}/link`)
      .send({ appId: otherPlay.id })
      .expect(400);

    expectEnvelope(
      response.body as ApiErrorEnvelope,
      400,
      `/apps/${apple.id}/link`,
    );
  });

  it('unlinks and removes the group for the counterpart', async () => {
    const apple = await importApp(APP_STORE_URL);
    const play = await importApp(GOOGLE_PLAY_URL);
    await request(app.getHttpServer())
      .post(`/apps/${apple.id}/link`)
      .send({ appId: play.id })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/apps/${apple.id}/link`)
      .expect(204);

    const playDetail = await request(app.getHttpServer())
      .get(`/apps/${play.id}`)
      .expect(200);
    expect((playDetail.body as AppDetail).group).toBeNull();
    expect(await prisma.appGroup.count()).toBe(0);
  });

  it('leaves the counterpart ungrouped when a linked app is deleted', async () => {
    const apple = await importApp(APP_STORE_URL);
    const play = await importApp(GOOGLE_PLAY_URL);
    await request(app.getHttpServer())
      .post(`/apps/${apple.id}/link`)
      .send({ appId: play.id })
      .expect(201);

    await request(app.getHttpServer()).delete(`/apps/${apple.id}`).expect(204);

    const playDetail = await request(app.getHttpServer())
      .get(`/apps/${play.id}`)
      .expect(200);
    expect((playDetail.body as AppDetail).group).toBeNull();
    expect(await prisma.appGroup.count()).toBe(0);
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

  it('probes availability for a non-home storefront', async () => {
    const imported = await importApp(GOOGLE_PLAY_URL);

    for (const status of [
      'available',
      'unavailable',
      'unknown',
    ] as MarketAvailability[]) {
      registry.availabilityStatus = status;
      const response = await request(app.getHttpServer())
        .get(`/apps/${imported.id}/market-availability`)
        .query({ country: 'de' })
        .expect(200);
      expect(response.body as MarketAvailabilityResult).toEqual({
        country: 'de',
        status,
      });
    }

    expect(registry.availabilityCalls).toHaveLength(3);
    expect(registry.availabilityCalls[0]).toEqual({
      storeAppId: 'com.example.app',
      countries: ['de'],
    });
  });

  it('short-circuits the home market without a store request', async () => {
    const imported = await importApp(APP_STORE_URL);

    const response = await request(app.getHttpServer())
      .get(`/apps/${imported.id}/market-availability`)
      .query({ country: 'us' })
      .expect(200);

    expect(response.body as MarketAvailabilityResult).toEqual({
      country: 'us',
      status: 'available',
    });
    expect(registry.availabilityCalls).toHaveLength(0);
  });

  it('rejects a malformed country', async () => {
    const imported = await importApp(APP_STORE_URL);

    await request(app.getHttpServer())
      .get(`/apps/${imported.id}/market-availability`)
      .query({ country: 'GERMANY' })
      .expect(400);
  });
});
