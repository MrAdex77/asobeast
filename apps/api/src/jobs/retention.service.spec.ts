import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { RetentionService } from './retention.service';

type Days = Partial<Record<keyof Env, number>>;

const buildConfig = (days: Days): ConfigService<Env, true> => {
  const values: Days = {
    RETENTION_RANKINGS_DAYS: 365,
    RETENTION_SERP_DAYS: 90,
    RETENTION_SNAPSHOTS_DAYS: 180,
    RETENTION_CATEGORY_RANKS_DAYS: 365,
    RETENTION_CHANGE_EVENTS_DAYS: 0,
    RETENTION_DELIVERIES_DAYS: 30,
    ...days,
  };
  return {
    get: jest.fn((key: keyof Env) => values[key]),
  } as unknown as ConfigService<Env, true>;
};

const buildPrisma = () => ({
  keywordRanking: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
  serpEntry: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
  categoryRank: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
  changeEvent: { deleteMany: jest.fn().mockResolvedValue({ count: 4 }) },
  alertDelivery: { deleteMany: jest.fn().mockResolvedValue({ count: 6 }) },
  suggestProbe: { deleteMany: jest.fn().mockResolvedValue({ count: 7 }) },
  appSnapshot: {
    findMany: jest.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }]),
    deleteMany: jest.fn().mockResolvedValue({ count: 5 }),
  },
});

describe('RetentionService', () => {
  it('issues no delete for a disabled rule', async () => {
    const prisma = buildPrisma();
    const service = new RetentionService(
      buildConfig({ RETENTION_RANKINGS_DAYS: 0 }),
      prisma as unknown as PrismaService,
    );

    const deleted = await service.prune();

    expect(prisma.keywordRanking.deleteMany).not.toHaveBeenCalled();
    expect(deleted.keywordRanking).toBe(0);
  });

  it('computes the cutoff at UTC midnight minus the retention window', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-13T09:30:00.000Z'));
    const prisma = buildPrisma();
    const service = new RetentionService(
      buildConfig({ RETENTION_RANKINGS_DAYS: 10 }),
      prisma as unknown as PrismaService,
    );

    await service.prune();

    const [{ where }] = prisma.keywordRanking.deleteMany.mock.calls[0] as [
      { where: { date: { lt: Date } } },
    ];
    expect(where.date.lt).toEqual(new Date('2026-07-03T00:00:00.000Z'));
    jest.useRealTimers();
  });

  it('always keeps the newest snapshot id per app', async () => {
    const prisma = buildPrisma();
    const service = new RetentionService(
      buildConfig({}),
      prisma as unknown as PrismaService,
    );

    await service.prune();

    expect(prisma.appSnapshot.findMany).toHaveBeenCalledWith({
      distinct: ['appId'],
      orderBy: { capturedAt: 'desc' },
      select: { id: true },
    });
    const [{ where }] = prisma.appSnapshot.deleteMany.mock.calls[0] as [
      { where: { id: { notIn: string[] } } },
    ];
    expect(where.id).toEqual({ notIn: ['a', 'b'] });
  });

  it('prunes the alert delivery log with its own knob', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-13T09:30:00.000Z'));
    const prisma = buildPrisma();
    const service = new RetentionService(
      buildConfig({ RETENTION_DELIVERIES_DAYS: 30 }),
      prisma as unknown as PrismaService,
    );

    const deleted = await service.prune();

    expect(deleted.alertDelivery).toBe(6);
    const [{ where }] = prisma.alertDelivery.deleteMany.mock.calls[0] as [
      { where: { createdAt: { lt: Date } } },
    ];
    expect(where.createdAt.lt).toEqual(new Date('2026-06-13T00:00:00.000Z'));
    jest.useRealTimers();
  });

  it('keeps deliveries forever when the knob is zero', async () => {
    const prisma = buildPrisma();
    const service = new RetentionService(
      buildConfig({ RETENTION_DELIVERIES_DAYS: 0 }),
      prisma as unknown as PrismaService,
    );

    const deleted = await service.prune();

    expect(prisma.alertDelivery.deleteMany).not.toHaveBeenCalled();
    expect(deleted.alertDelivery).toBe(0);
  });

  it('runs remaining pruners when one fails', async () => {
    const prisma = buildPrisma();
    prisma.keywordRanking.deleteMany.mockRejectedValue(new Error('boom'));
    const service = new RetentionService(
      buildConfig({}),
      prisma as unknown as PrismaService,
    );

    const deleted = await service.prune();

    expect(deleted.keywordRanking).toBeUndefined();
    expect(prisma.serpEntry.deleteMany).toHaveBeenCalled();
    expect(deleted.serpEntry).toBe(2);
  });

  it('rethrows when every pruner fails', async () => {
    const prisma = buildPrisma();
    const boom = () => Promise.reject(new Error('boom'));
    prisma.keywordRanking.deleteMany.mockImplementation(boom);
    prisma.serpEntry.deleteMany.mockImplementation(boom);
    prisma.categoryRank.deleteMany.mockImplementation(boom);
    prisma.changeEvent.deleteMany.mockImplementation(boom);
    prisma.alertDelivery.deleteMany.mockImplementation(boom);
    prisma.suggestProbe.deleteMany.mockImplementation(boom);
    prisma.appSnapshot.deleteMany.mockImplementation(boom);
    const service = new RetentionService(
      buildConfig({ RETENTION_CHANGE_EVENTS_DAYS: 30 }),
      prisma as unknown as PrismaService,
    );

    await expect(service.prune()).rejects.toThrow(
      'data retention failed for every table',
    );
  });
});
