import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue } from 'bullmq';
import { AlertFlushService } from '../alerts/alert-flush.service';
import { AuditService } from '../audit/audit.service';
import { Env } from '../config/env';
import { DigestService } from './digest.service';
import { JOBS, LAST_DAILY_RUN_KEY, QUEUES } from './jobs.types';
import { PipelineService } from './pipeline.service';
import { RetentionService } from './retention.service';

@Processor(QUEUES.PIPELINE)
export class PipelineWorker extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(PipelineWorker.name);

  constructor(
    @InjectQueue(QUEUES.PIPELINE) private readonly pipelineQueue: Queue,
    private readonly config: ConfigService<Env, true>,
    private readonly pipeline: PipelineService,
    private readonly retention: RetentionService,
    private readonly digest: DigestService,
    private readonly audit: AuditService,
    private readonly alertFlush: AlertFlushService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.pipelineQueue.upsertJobScheduler(
      'daily',
      { pattern: this.config.get('CRON_DAILY', { infer: true }), tz: 'UTC' },
      { name: JOBS.DAILY },
    );
    await this.pipelineQueue.upsertJobScheduler(
      'weekly',
      { pattern: this.config.get('CRON_SCORING', { infer: true }), tz: 'UTC' },
      { name: JOBS.SCORING },
    );
    await this.pipelineQueue.upsertJobScheduler(
      'retention',
      {
        pattern: this.config.get('CRON_RETENTION', { infer: true }),
        tz: 'UTC',
      },
      { name: JOBS.RETENTION },
    );
    await this.pipelineQueue.upsertJobScheduler(
      'digest',
      { pattern: this.config.get('CRON_DIGEST', { infer: true }), tz: 'UTC' },
      { name: JOBS.DIGEST },
    );
    await this.pipelineQueue.upsertJobScheduler(
      'audit',
      { pattern: this.config.get('CRON_AUDIT', { infer: true }), tz: 'UTC' },
      { name: JOBS.AUDIT_SNAPSHOT },
    );
    await this.pipelineQueue.upsertJobScheduler(
      'alert-flush',
      {
        pattern: this.config.get('CRON_ALERT_FLUSH', { infer: true }),
        tz: 'UTC',
      },
      { name: JOBS.ALERT_FLUSH },
    );
  }

  async process(job: Job): Promise<void> {
    if (job.name === JOBS.DAILY) {
      await this.pipeline.fanOutDaily();
      const client = await this.pipelineQueue.client;
      await client.set(LAST_DAILY_RUN_KEY, new Date().toISOString());
      return;
    }
    if (job.name === JOBS.SCORING) {
      await this.pipeline.fanOutScoring();
      return;
    }
    if (job.name === JOBS.RETENTION) {
      await this.retention.prune();
      return;
    }
    if (job.name === JOBS.DIGEST) {
      await this.digest.run();
      return;
    }
    if (job.name === JOBS.AUDIT_SNAPSHOT) {
      await this.audit.snapshotAll();
      return;
    }
    if (job.name === JOBS.ALERT_FLUSH) {
      await this.alertFlush.flush();
      return;
    }
    throw new Error(`Unknown pipeline job ${job.name}`);
  }
}
