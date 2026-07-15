import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { AppsService } from '../apps/apps.service';
import { CategoryRanksService } from '../category-ranks/category-ranks.service';
import { KeywordsService } from '../keywords/keywords.service';
import { RankingsService } from '../rankings/rankings.service';
import { ReviewsService } from '../reviews/reviews.service';
import { ScoringService } from '../scoring/scoring.service';
import {
  CheckCategoryPayload,
  CheckKeywordPayload,
  JOBS,
  RefreshAppPayload,
  ScoreKeywordPayload,
  SpiderProbePayload,
  SyncReviewsPayload,
} from './jobs.types';

@Injectable()
export class StoreJobsHandler {
  constructor(
    private readonly apps: AppsService,
    private readonly rankings: RankingsService,
    private readonly scoring: ScoringService,
    private readonly categoryRanks: CategoryRanksService,
    private readonly reviews: ReviewsService,
    private readonly keywords: KeywordsService,
  ) {}

  async handle(job: Job): Promise<void> {
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
      case JOBS.SPIDER_PROBE:
        await this.keywords.runSpiderProbe(job.data as SpiderProbePayload);
        return;
      default:
        throw new Error(`Unknown job ${job.name}`);
    }
  }
}
