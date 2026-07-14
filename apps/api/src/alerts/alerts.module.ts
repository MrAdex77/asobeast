import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '../jobs/jobs.types';
import { AlertsController } from './alerts.controller';
import { AlertsDispatcher } from './alerts.dispatcher';
import { AlertsWorker } from './alerts.worker';
import { EmailAlertsController } from './email-alerts.controller';
import { EmailAlertsService } from './email-alerts.service';
import { MailerService } from './mailer.service';
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
  controllers: [WebhooksController, EmailAlertsController, AlertsController],
  providers: [
    WebhooksService,
    EmailAlertsService,
    WebhookDelivery,
    MailerService,
    AlertsDispatcher,
    AlertsWorker,
  ],
  exports: [AlertsDispatcher, BullModule],
})
export class AlertsModule {}
