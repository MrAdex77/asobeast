import { NotFoundException } from '@nestjs/common';
import { Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { ReviewResult } from '../store-providers/types';
import { ReviewsService } from './reviews.service';

const makeReview = (reviewId: string, score = 5): ReviewResult => ({
  reviewId,
  userName: 'User',
  score,
  title: 'Title',
  text: 'Body',
  version: '1.0.0',
  updatedAt: new Date('2026-07-01T00:00:00Z'),
});

const buildDeps = (options: {
  pages: ReviewResult[][];
  existing: string[];
}) => {
  const reviews = jest.fn();
  options.pages.forEach((page) => reviews.mockResolvedValueOnce(page));
  const createMany = jest.fn().mockResolvedValue({ count: 0 });
  const prisma = {
    app: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'app1',
        store: Store.APP_STORE,
        storeAppId: '123',
        country: 'us',
      }),
    },
    review: {
      findMany: jest
        .fn()
        .mockResolvedValue(options.existing.map((reviewId) => ({ reviewId }))),
      createMany,
    },
  };
  const registry = { get: () => ({ reviews }) };
  const service = new ReviewsService(
    prisma as unknown as PrismaService,
    registry as unknown as StoreProviderRegistry,
  );
  return { service, reviews, createMany };
};

describe('ReviewsService.syncReviews', () => {
  it('fetches every requested page in order', async () => {
    const { service, reviews } = buildDeps({
      pages: [[makeReview('a')], [makeReview('b')]],
      existing: [],
    });

    await service.syncReviews({ appId: 'app1', pages: 2, backfill: true });

    expect(reviews).toHaveBeenNthCalledWith(1, '123', 'us', 1);
    expect(reviews).toHaveBeenNthCalledWith(2, '123', 'us', 2);
  });

  it('inserts and returns only reviews not already stored', async () => {
    const { service, createMany } = buildDeps({
      pages: [[makeReview('a'), makeReview('b')]],
      existing: ['a'],
    });

    const inserted = await service.syncReviews({
      appId: 'app1',
      pages: 1,
      backfill: false,
    });

    expect(inserted.map((review) => review.reviewId)).toEqual(['b']);
    expect(createMany).toHaveBeenCalledTimes(1);
    const data = createMany.mock.calls[0][0].data as { reviewId: string }[];
    expect(data.map((row) => row.reviewId)).toEqual(['b']);
  });

  it('deduplicates the same review across pages', async () => {
    const { service, createMany } = buildDeps({
      pages: [[makeReview('a')], [makeReview('a'), makeReview('c')]],
      existing: [],
    });

    const inserted = await service.syncReviews({
      appId: 'app1',
      pages: 2,
      backfill: true,
    });

    expect(inserted.map((review) => review.reviewId)).toEqual(['a', 'c']);
    const data = createMany.mock.calls[0][0].data as { reviewId: string }[];
    expect(data.map((row) => row.reviewId)).toEqual(['a', 'c']);
  });

  it('skips the insert when every review already exists', async () => {
    const { service, createMany } = buildDeps({
      pages: [[makeReview('a')]],
      existing: ['a'],
    });

    const inserted = await service.syncReviews({
      appId: 'app1',
      pages: 1,
      backfill: false,
    });

    expect(inserted).toEqual([]);
    expect(createMany).not.toHaveBeenCalled();
  });

  it('rejects an unknown app', async () => {
    const prisma = {
      app: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new ReviewsService(
      prisma as unknown as PrismaService,
      { get: jest.fn() } as unknown as StoreProviderRegistry,
    );

    await expect(
      service.syncReviews({ appId: 'missing', pages: 1, backfill: false }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
