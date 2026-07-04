import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AppsService } from '../apps/apps.service';
import { JOBS, QUEUES, RefreshAppPayload } from './jobs.types';

const ITUNES_RPM = Number(process.env.SCRAPE_ITUNES_RPM) || 15;

@Processor(QUEUES.APP_STORE, {
  concurrency: 1,
  limiter: { max: ITUNES_RPM, duration: 60_000 },
})
export class AppStoreWorker extends WorkerHost {
  private readonly logger = new Logger(AppStoreWorker.name);

  constructor(private readonly apps: AppsService) {
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
      case JOBS.SCORE_KEYWORD:
        throw new Error('SCORE_KEYWORD is not implemented until Phase 6');
      default:
        throw new Error(`Unknown job ${job.name}`);
    }
  }
}
