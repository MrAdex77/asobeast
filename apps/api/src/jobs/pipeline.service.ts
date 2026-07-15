import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DailyBudget, FanOutSummary, Store } from '@asobeast/shared';
import { Queue } from 'bullmq';
import { CategoryRanksService } from '../category-ranks/category-ranks.service';
import { DEFAULT_WORKSPACE_ID } from '../common/workspace';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import {
  categoryJobId,
  isoWeekKey,
  JOBS,
  QUEUES,
  queueNameForStore,
  reviewsJobId,
  scoreJobId,
  utcDateKey,
} from './jobs.types';

interface AppTarget {
  id: string;
  store: Store;
}

interface KeywordTarget {
  keywordId: string;
  store: Store;
}

interface DailyTargets {
  apps: AppTarget[];
  keywords: KeywordTarget[];
  reviewApps: AppTarget[];
}

@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  constructor(
    @InjectQueue(QUEUES.APP_STORE) private readonly appStoreQueue: Queue,
    @InjectQueue(QUEUES.GPLAY) private readonly gplayQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly categoryRanks: CategoryRanksService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async fanOutDaily(): Promise<FanOutSummary> {
    return this.enqueue(await this.collectDailyTargets());
  }

  async estimateDailyBudget(): Promise<DailyBudget> {
    const targets = await this.collectDailyTargets();
    const categories = (
      await this.categoryRanks.buckets(targets.apps.map((app) => app.id))
    ).length;
    const total =
      targets.apps.length +
      targets.keywords.length +
      categories +
      targets.reviewApps.length;
    const capacityPerDay =
      this.config.get('SCRAPE_ITUNES_RPM', { infer: true }) * 60 * 24;

    return {
      apps: targets.apps.length,
      keywords: targets.keywords.length,
      categories,
      reviews: targets.reviewApps.length,
      total,
      capacityPerDay,
      utilization: Math.round((total / capacityPerDay) * 1000) / 1000,
    };
  }

  private async collectDailyTargets(): Promise<DailyTargets> {
    const apps = await this.prisma.app.findMany({
      where: { workspaceId: DEFAULT_WORKSPACE_ID },
      select: { id: true, isCompetitor: true, store: true },
    });
    const keywords = await this.prisma.trackedKeyword.findMany({
      where: { active: true, app: { workspaceId: DEFAULT_WORKSPACE_ID } },
      select: { keywordId: true, keyword: { select: { store: true } } },
      distinct: ['keywordId'],
    });

    return {
      apps: apps.map((app) => ({ id: app.id, store: app.store })),
      keywords: keywords.map((keyword) => ({
        keywordId: keyword.keywordId,
        store: keyword.keyword.store,
      })),
      reviewApps: apps
        .filter((app) => !app.isCompetitor)
        .map((app) => ({ id: app.id, store: app.store })),
    };
  }

  async fanOutApp(appId: string): Promise<FanOutSummary> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId, workspaceId: DEFAULT_WORKSPACE_ID },
      select: {
        id: true,
        store: true,
        isCompetitor: true,
        competitors: { select: { id: true, store: true } },
        tracked: {
          where: { active: true },
          select: { keywordId: true, keyword: { select: { store: true } } },
        },
      },
    });
    if (!app) {
      throw new NotFoundException(`App ${appId} not found`);
    }

    const apps: AppTarget[] = [
      { id: app.id, store: app.store },
      ...app.competitors.map((competitor) => ({
        id: competitor.id,
        store: competitor.store,
      })),
    ];
    const keywords = this.dedupeKeywords(
      app.tracked.map((tracked) => ({
        keywordId: tracked.keywordId,
        store: tracked.keyword.store,
      })),
    );
    const reviewApps: AppTarget[] = app.isCompetitor
      ? []
      : [{ id: app.id, store: app.store }];

    return this.enqueue({ apps, keywords, reviewApps });
  }

  async fanOutScoring(): Promise<number> {
    const keywords = await this.prisma.trackedKeyword.findMany({
      where: { active: true, app: { workspaceId: DEFAULT_WORKSPACE_ID } },
      select: { keywordId: true, keyword: { select: { store: true } } },
      distinct: ['keywordId'],
    });

    const week = isoWeekKey();
    for (const { keywordId, keyword } of keywords) {
      await this.queueFor(keyword.store).add(
        JOBS.SCORE_KEYWORD,
        { keywordId },
        { jobId: scoreJobId(keywordId, week) },
      );
    }

    this.logger.log(`fan out scoring ${keywords.length}`);
    return keywords.length;
  }

  async enqueueScore(keywordId: string): Promise<void> {
    const keyword = await this.prisma.keyword.findUnique({
      where: { id: keywordId },
      select: { store: true },
    });
    if (!keyword) {
      throw new NotFoundException(`Keyword ${keywordId} not found`);
    }
    await this.queueFor(keyword.store).add(
      JOBS.SCORE_KEYWORD,
      { keywordId },
      { jobId: scoreJobId(keywordId, utcDateKey()) },
    );
  }

  private async enqueue(targets: DailyTargets): Promise<FanOutSummary> {
    const date = utcDateKey();

    for (const app of targets.apps) {
      await this.queueFor(app.store).add(
        JOBS.REFRESH_APP,
        { appId: app.id },
        { jobId: `refresh:${app.id}:${date}` },
      );
    }
    for (const keyword of targets.keywords) {
      await this.queueFor(keyword.store).add(
        JOBS.CHECK_KEYWORD,
        { keywordId: keyword.keywordId },
        { jobId: `check:${keyword.keywordId}:${date}` },
      );
    }
    for (const app of targets.reviewApps) {
      await this.queueFor(app.store).add(
        JOBS.SYNC_REVIEWS,
        { appId: app.id, pages: 1, backfill: false },
        { jobId: reviewsJobId(app.id, date) },
      );
    }

    const buckets = await this.categoryRanks.buckets(
      targets.apps.map((app) => app.id),
    );
    for (const bucket of buckets) {
      await this.queueFor(bucket.store).add(JOBS.CHECK_CATEGORY, bucket, {
        jobId: categoryJobId(
          bucket.collection,
          bucket.genre,
          bucket.country,
          date,
        ),
      });
    }

    const summary: FanOutSummary = {
      apps: targets.apps.length,
      keywords: targets.keywords.length,
      categories: buckets.length,
      reviews: targets.reviewApps.length,
    };
    this.logger.log(`fan out ${JSON.stringify(summary)}`);
    return summary;
  }

  private dedupeKeywords(keywords: KeywordTarget[]): KeywordTarget[] {
    const seen = new Map<string, KeywordTarget>();
    for (const keyword of keywords) {
      if (!seen.has(keyword.keywordId)) {
        seen.set(keyword.keywordId, keyword);
      }
    }
    return [...seen.values()];
  }

  private queueFor(store: Store): Queue {
    return queueNameForStore(store) === QUEUES.GPLAY
      ? this.gplayQueue
      : this.appStoreQueue;
  }
}
