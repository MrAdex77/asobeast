import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env';
import { QUEUES } from './jobs.types';

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
  ],
  exports: [BullModule],
})
export class JobsModule {}
