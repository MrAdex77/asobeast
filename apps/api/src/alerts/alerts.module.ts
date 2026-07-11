import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '../jobs/jobs.types';
import { AlertsDispatcher } from './alerts.dispatcher';
import { AlertsWorker } from './alerts.worker';
import { WebhookDelivery } from './webhook-delivery';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: QUEUES.ALERTS,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 10_000 },
      },
    }),
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookDelivery, AlertsDispatcher, AlertsWorker],
  exports: [AlertsDispatcher, BullModule],
})
export class AlertsModule {}
