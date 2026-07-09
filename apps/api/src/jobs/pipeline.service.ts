import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FanOutSummary } from '@asobeast/shared';
import { Queue } from 'bullmq';
import { DEFAULT_WORKSPACE_ID } from '../common/workspace';
import { PrismaService } from '../prisma/prisma.service';
import { isoWeekKey, JOBS, QUEUES, scoreJobId, utcDateKey } from './jobs.types';

@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  constructor(
    @InjectQueue(QUEUES.APP_STORE) private readonly appStoreQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  async fanOutDaily(): Promise<FanOutSummary> {
    const apps = await this.prisma.app.findMany({
      where: { workspaceId: DEFAULT_WORKSPACE_ID },
      select: { id: true },
    });
    const keywords = await this.prisma.trackedKeyword.findMany({
      where: { active: true, app: { workspaceId: DEFAULT_WORKSPACE_ID } },
      select: { keywordId: true },
      distinct: ['keywordId'],
    });

    return this.enqueue(
      apps.map((app) => app.id),
      keywords.map((keyword) => keyword.keywordId),
    );
  }

  async fanOutApp(appId: string): Promise<FanOutSummary> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId, workspaceId: DEFAULT_WORKSPACE_ID },
      select: {
        id: true,
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

    return this.enqueue(appIds, keywordIds);
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

    const summary: FanOutSummary = {
      apps: appIds.length,
      keywords: keywordIds.length,
    };
    this.logger.log(`fan out ${JSON.stringify(summary)}`);
    return summary;
  }
}
