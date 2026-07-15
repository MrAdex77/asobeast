import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES } from './jobs.types';
import { StoreJobsHandler } from './store-jobs.handler';

const GPLAY_RPM = Number(process.env.SCRAPE_GPLAY_RPM) || 10;

@Processor(QUEUES.GPLAY, {
  concurrency: 1,
  limiter: { max: GPLAY_RPM, duration: 60_000 },
})
export class GplayWorker extends WorkerHost {
  private readonly logger = new Logger(GplayWorker.name);

  constructor(private readonly handler: StoreJobsHandler) {
    super();
  }

  async process(job: Job): Promise<void> {
    const startedAt = Date.now();
    this.logger.debug(`start ${job.name} #${job.id}`);
    try {
      await this.handler.handle(job);
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
}
