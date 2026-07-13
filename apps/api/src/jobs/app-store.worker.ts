import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AppsService } from '../apps/apps.service';
import { CategoryRanksService } from '../category-ranks/category-ranks.service';
import { RankingsService } from '../rankings/rankings.service';
import { ReviewsService } from '../reviews/reviews.service';
import { ScoringService } from '../scoring/scoring.service';
import {
  CheckCategoryPayload,
  CheckKeywordPayload,
  JOBS,
  QUEUES,
  RefreshAppPayload,
  ScoreKeywordPayload,
  SyncReviewsPayload,
} from './jobs.types';

const ITUNES_RPM = Number(process.env.SCRAPE_ITUNES_RPM) || 15;

@Processor(QUEUES.APP_STORE, {
  concurrency: 1,
  limiter: { max: ITUNES_RPM, duration: 60_000 },
})
export class AppStoreWorker extends WorkerHost {
  private readonly logger = new Logger(AppStoreWorker.name);

  constructor(
    private readonly apps: AppsService,
    private readonly rankings: RankingsService,
    private readonly scoring: ScoringService,
    private readonly categoryRanks: CategoryRanksService,
    private readonly reviews: ReviewsService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const startedAt = Date.now();
    this.logger.debug(`start ${job.name} #${job.id}`);
    try {
      await this.handle(job);
      this.logger.debug(
        `done ${job.name} #${job.id} in ${Date.now() - startedAt}ms`,
      );
    } catch (error) {
      this.logger.warn(
        `failed ${job.name} #${job.id}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  private async handle(job: Job): Promise<void> {
    switch (job.name) {
      case JOBS.REFRESH_APP:
        await this.apps.refreshApp((job.data as RefreshAppPayload).appId);
        return;
      case JOBS.CHECK_KEYWORD:
        await this.rankings.checkKeyword(
          (job.data as CheckKeywordPayload).keywordId,
        );
        return;
      case JOBS.CHECK_CATEGORY:
        await this.categoryRanks.checkCategory(
          job.data as CheckCategoryPayload,
        );
        return;
      case JOBS.SCORE_KEYWORD:
        await this.scoring.scoreKeyword(
          (job.data as ScoreKeywordPayload).keywordId,
        );
        return;
      case JOBS.SYNC_REVIEWS:
        await this.reviews.syncReviews(job.data as SyncReviewsPayload);
        return;
      default:
        throw new Error(`Unknown job ${job.name}`);
    }
  }
}
