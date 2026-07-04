import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppsModule } from '../apps/apps.module';
import { Env } from '../config/env';
import { RankingsModule } from '../rankings/rankings.module';
import { AppStoreWorker } from './app-store.worker';
import { JobsController } from './jobs.controller';
import { QUEUES } from './jobs.types';
import { PipelineService } from './pipeline.service';
import { PipelineWorker } from './pipeline.worker';

const bullBoardModules: DynamicModule[] =
  (process.env.BULL_BOARD_ENABLED ?? 'true') === 'false'
    ? []
    : [
        BullBoardModule.forRoot({
          route: '/admin/queues',
          adapter: ExpressAdapter,
        }),
        BullBoardModule.forFeature(
          { name: QUEUES.PIPELINE, adapter: BullMQAdapter },
          { name: QUEUES.APP_STORE, adapter: BullMQAdapter },
        ),
      ];

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
    ...bullBoardModules,
  ],
  controllers: [JobsController],
  providers: [AppStoreWorker, PipelineWorker, PipelineService],
  exports: [BullModule],
})
export class JobsModule {}
