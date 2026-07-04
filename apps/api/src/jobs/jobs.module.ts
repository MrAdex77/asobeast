import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppsModule } from '../apps/apps.module';
import { Env } from '../config/env';
import { RankingsModule } from '../rankings/rankings.module';
import { AppStoreWorker } from './app-store.worker';
import { JobsController } from './jobs.controller';
import { QUEUES } from './jobs.types';
import { PipelineService } from './pipeline.service';
import { PipelineWorker } from './pipeline.worker';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        connection: {
          host: config.get('REDIS_HOST', { infer: true }),
          port: config.get('REDIS_PORT', { infer: true }),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUES.PIPELINE },
      { name: QUEUES.APP_STORE },
    ),
    AppsModule,
    RankingsModule,
  ],
  controllers: [JobsController],
  providers: [AppStoreWorker, PipelineWorker, PipelineService],
  exports: [BullModule],
})
export class JobsModule {}
