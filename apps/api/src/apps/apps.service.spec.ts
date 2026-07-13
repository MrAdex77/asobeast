import { BadRequestException } from '@nestjs/common';
import { Store } from '@prisma/client';
import { Queue } from 'bullmq';
import { ChangesService } from '../changes/changes.service';
import { KeywordsService } from '../keywords/keywords.service';
import { PrismaService } from '../prisma/prisma.service';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { AppsService } from './apps.service';

describe('AppsService.addCompetitor', () => {
  const buildDeps = (competitorCount: number) => {
    const getApp = jest.fn().mockResolvedValue({
      title: 'Rival',
      iconUrl: 'https://icon',
      subtitle: null,
      summary: null,
      description: 'd',
      ratingAvg: null,
      ratingCount: null,
      installs: null,
      price: null,
      version: null,
      releasedAt: null,
      storeUpdatedAt: null,
      raw: {},
    });
    const created = {
      id: 'comp1',
      store: Store.APP_STORE,
      name: 'Rival',
      iconUrl: 'https://icon',
      isCompetitor: true,
      primaryAppId: 'primary',
    };
    const snapshot = {
      id: 'snap1',
      title: 'Rival',
      subtitle: null,
      summary: null,
      ratingAvg: null,
      ratingCount: null,
      installs: null,
      price: null,
      version: null,
      capturedAt: new Date('2026-07-05T00:00:00Z'),
    };
    const upsert = jest
      .fn<
        Promise<typeof created>,
        [
          {
            create: {
              isCompetitor: boolean;
              primaryAppId?: string;
              country: string;
            };
          },
        ]
      >()
      .mockResolvedValue(created);
    const tx = {
      app: { upsert },
      appSnapshot: { create: jest.fn().mockResolvedValue(snapshot) },
    };
    const prisma = {
      app: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'primary',
          store: Store.APP_STORE,
          country: 'us',
          _count: { competitors: competitorCount },
        }),
      },
      $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    };
    const registry = { get: () => ({ getApp }) };
    const keywords = { syncFromSnapshot: jest.fn() };
    const changes = { recordRefresh: jest.fn().mockResolvedValue([]) };
    const appStoreQueue = { add: jest.fn().mockResolvedValue(undefined) };
    const service = new AppsService(
      prisma as unknown as PrismaService,
      registry as unknown as StoreProviderRegistry,
      keywords as unknown as KeywordsService,
      changes as unknown as ChangesService,
      appStoreQueue as unknown as Queue,
    );
    return { service, prisma, upsert, keywords, getApp, appStoreQueue };
  };

  it('creates a competitor row and skips keyword sync', async () => {
    const { service, upsert, keywords } = buildDeps(0);

    await service.addCompetitor(
      'primary',
      'https://apps.apple.com/us/app/rival/id999',
    );

    const createArg = upsert.mock.calls[0][0].create;
    expect(createArg.isCompetitor).toBe(true);
    expect(createArg.primaryAppId).toBe('primary');
    expect(createArg.country).toBe('us');
    expect(keywords.syncFromSnapshot).not.toHaveBeenCalled();
  });

  it('rejects a competitor on a different store', async () => {
    const { service } = buildDeps(0);

    await expect(
      service.addCompetitor(
        'primary',
        'https://play.google.com/store/apps/details?id=com.rival.app',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects once the competitor cap is reached', async () => {
    const { service } = buildDeps(10);

    await expect(
      service.addCompetitor(
        'primary',
        'https://apps.apple.com/us/app/rival/id999',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
