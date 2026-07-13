import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FanOutSummary } from '@asobeast/shared';
import { Queue } from 'bullmq';
import { CategoryRanksService } from '../category-ranks/category-ranks.service';
import { DEFAULT_WORKSPACE_ID } from '../common/workspace';
import { PrismaService } from '../prisma/prisma.service';
import {
  categoryJobId,
  isoWeekKey,
  JOBS,
  QUEUES,
  reviewsJobId,
  scoreJobId,
  utcDateKey,
} from './jobs.types';

@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  constructor(
    @InjectQueue(QUEUES.APP_STORE) private readonly appStoreQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly categoryRanks: CategoryRanksService,
  ) {}

  async fanOutDaily(): Promise<FanOutSummary> {
    const apps = await this.prisma.app.findMany({
      where: { workspaceId: DEFAULT_WORKSPACE_ID },
      select: { id: true, isCompetitor: true },
    });
    const keywords = await this.prisma.trackedKeyword.findMany({
      where: { active: true, app: { workspaceId: DEFAULT_WORKSPACE_ID } },
      select: { keywordId: true },
      distinct: ['keywordId'],
    });

    return this.enqueue(
      apps.map((app) => app.id),
      keywords.map((keyword) => keyword.keywordId),
      apps.filter((app) => !app.isCompetitor).map((app) => app.id),
    );
  }

  async fanOutApp(appId: string): Promise<FanOutSummary> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId, workspaceId: DEFAULT_WORKSPACE_ID },
      select: {
        id: true,
        isCompetitor: true,
        competitors: { select: { id: true } },
        tracked: { where: { active: true }, select: { keywordId: true } },
      },
    });
    if (!app) {
      throw new NotFoundException(`App ${appId} not found`);
    }

    const appIds = [
      app.id,
      ...app.competitors.map((competitor) => competitor.id),
    ];
    const keywordIds = [
      ...new Set(app.tracked.map((tracked) => tracked.keywordId)),
    ];
    const reviewAppIds = app.isCompetitor ? [] : [app.id];

    return this.enqueue(appIds, keywordIds, reviewAppIds);
  }

  async fanOutScoring(): Promise<number> {
    const keywords = await this.prisma.trackedKeyword.findMany({
      where: { active: true, app: { workspaceId: DEFAULT_WORKSPACE_ID } },
      select: { keywordId: true },
      distinct: ['keywordId'],
    });

    const week = isoWeekKey();
    for (const { keywordId } of keywords) {
      await this.appStoreQueue.add(
        JOBS.SCORE_KEYWORD,
        { keywordId },
        { jobId: scoreJobId(keywordId, week) },
      );
    }

    this.logger.log(`fan out scoring ${keywords.length}`);
    return keywords.length;
  }

  async enqueueScore(keywordId: string): Promise<void> {
    await this.appStoreQueue.add(
      JOBS.SCORE_KEYWORD,
      { keywordId },
      { jobId: scoreJobId(keywordId, utcDateKey()) },
    );
  }

  private async enqueue(
    appIds: string[],
    keywordIds: string[],
    reviewAppIds: string[],
  ): Promise<FanOutSummary> {
    const date = utcDateKey();

    for (const appId of appIds) {
      await this.appStoreQueue.add(
        JOBS.REFRESH_APP,
        { appId },
        { jobId: `refresh:${appId}:${date}` },
      );
    }
    for (const keywordId of keywordIds) {
      await this.appStoreQueue.add(
        JOBS.CHECK_KEYWORD,
        { keywordId },
        { jobId: `check:${keywordId}:${date}` },
      );
    }
    for (const appId of reviewAppIds) {
      await this.appStoreQueue.add(
        JOBS.SYNC_REVIEWS,
        { appId, pages: 1, backfill: false },
        { jobId: reviewsJobId(appId, date) },
      );
    }

    const buckets = await this.categoryRanks.buckets(appIds);
    for (const bucket of buckets) {
      await this.appStoreQueue.add(JOBS.CHECK_CATEGORY, bucket, {
        jobId: categoryJobId(
          bucket.collection,
          bucket.genreId,
          bucket.country,
          date,
        ),
      });
    }

    const summary: FanOutSummary = {
      apps: appIds.length,
      keywords: keywordIds.length,
      categories: buckets.length,
      reviews: reviewAppIds.length,
    };
    this.logger.log(`fan out ${JSON.stringify(summary)}`);
    return summary;
  }
}
