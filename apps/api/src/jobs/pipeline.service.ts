import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { DEFAULT_WORKSPACE_ID } from '../common/workspace';
import { PrismaService } from '../prisma/prisma.service';
import { JOBS, QUEUES } from './jobs.types';

export interface FanOutSummary {
  apps: number;
  keywords: number;
}

function utcDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

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
