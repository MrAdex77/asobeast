import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DeliverAlertPayload, QUEUES } from '../jobs/jobs.types';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookDelivery } from './webhook-delivery';

@Processor(QUEUES.ALERTS, { concurrency: 5 })
export class AlertsWorker extends WorkerHost {
  private readonly logger = new Logger(AlertsWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly delivery: WebhookDelivery,
  ) {
    super();
  }

  async process(job: Job<DeliverAlertPayload>): Promise<void> {
    const { webhookId, payload } = job.data;
    const webhook = await this.prisma.webhook.findUnique({
      where: { id: webhookId },
      select: { url: true, secret: true },
    });
    if (!webhook) {
      return;
    }
    await this.delivery.send(webhook.url, webhook.secret, payload);
    this.logger.debug(`delivered ${payload.event} to webhook ${webhookId}`);
  }
}
