import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ReviewItem, ReviewList } from '@asobeast/shared';
import { DEFAULT_WORKSPACE_ID } from '../common/workspace';
import { PrismaService } from '../prisma/prisma.service';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { ReviewResult } from '../store-providers/types';
import { SyncReviewsPayload } from '../jobs/jobs.types';

export interface ReviewListFilters {
  score?: number;
  version?: string;
  limit: number;
}

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: StoreProviderRegistry,
  ) {}

  async syncReviews(payload: SyncReviewsPayload): Promise<ReviewResult[]> {
    const app = await this.prisma.app.findFirst({
      where: { id: payload.appId, workspaceId: DEFAULT_WORKSPACE_ID },
      select: { id: true, store: true, storeAppId: true, country: true },
    });
    if (!app) {
      throw new NotFoundException(`App ${payload.appId} not found`);
    }

    const provider = this.registry.get(app.store);
    const fetched = new Map<string, ReviewResult>();
    for (let page = 1; page <= payload.pages; page++) {
      const results = await provider.reviews(app.storeAppId, app.country, page);
      for (const review of results) {
        if (!fetched.has(review.reviewId)) {
          fetched.set(review.reviewId, review);
        }
      }
    }

    const existing = await this.prisma.review.findMany({
      where: { appId: app.id, reviewId: { in: [...fetched.keys()] } },
      select: { reviewId: true },
    });
    const known = new Set(existing.map((row) => row.reviewId));
    const inserted = [...fetched.values()].filter(
      (review) => !known.has(review.reviewId),
    );

    if (inserted.length > 0) {
      await this.prisma.review.createMany({
        data: inserted.map((review) => ({
          appId: app.id,
          reviewId: review.reviewId,
          userName: review.userName ?? null,
          score: review.score,
          title: review.title ?? null,
          text: review.text,
          version: review.version ?? null,
          reviewedAt: review.updatedAt ?? null,
        })),
        skipDuplicates: true,
      });
    }

    return inserted;
  }

  async list(appId: string, filters: ReviewListFilters): Promise<ReviewList> {
    await this.ensureApp(appId);

    const where: Prisma.ReviewWhereInput = {
      appId,
      ...(filters.score !== undefined ? { score: filters.score } : {}),
      ...(filters.version !== undefined ? { version: filters.version } : {}),
    };

    const [reviews, total, versions] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        orderBy: { reviewedAt: 'desc' },
        take: filters.limit,
      }),
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where: { appId, version: { not: null } },
        distinct: ['version'],
        orderBy: { version: 'desc' },
        select: { version: true },
      }),
    ]);

    return {
      reviews: reviews.map((review) => this.toReviewItem(review)),
      total,
      versions: versions
        .map((row) => row.version)
        .filter((version): version is string => version !== null),
    };
  }

  private toReviewItem(review: {
    id: string;
    reviewId: string;
    userName: string | null;
    score: number;
    title: string | null;
    text: string;
    version: string | null;
    reviewedAt: Date | null;
  }): ReviewItem {
    return {
      id: review.id,
      reviewId: review.reviewId,
      userName: review.userName,
      score: review.score,
      title: review.title,
      text: review.text,
      version: review.version,
      reviewedAt: review.reviewedAt
        ? review.reviewedAt.toISOString()
        : null,
    };
  }

  private async ensureApp(id: string): Promise<void> {
    const app = await this.prisma.app.findFirst({
      where: { id, workspaceId: DEFAULT_WORKSPACE_ID },
      select: { id: true },
    });
    if (!app) {
      throw new NotFoundException(`App ${id} not found`);
    }
  }
}
