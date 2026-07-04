import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue } from 'bullmq';
import { Env } from '../config/env';
import { JOBS, QUEUES } from './jobs.types';
import { PipelineService } from './pipeline.service';

@Processor(QUEUES.PIPELINE)
export class PipelineWorker extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(PipelineWorker.name);

  constructor(
    @InjectQueue(QUEUES.PIPELINE) private readonly pipelineQueue: Queue,
    private readonly config: ConfigService<Env, true>,
    private readonly pipeline: PipelineService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.pipelineQueue.upsertJobScheduler(
      'daily',
      { pattern: this.config.get('CRON_DAILY', { infer: true }), tz: 'UTC' },
      { name: JOBS.DAILY },
    );
  }

  async process(job: Job): Promise<void> {
    if (job.name === JOBS.DAILY) {
      await this.pipeline.fanOutDaily();
      return;
    }
    throw new Error(`Unknown pipeline job ${job.name}`);
  }
}
