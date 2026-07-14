import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  DeliverAlertPayload,
  DeliverEmailPayload,
  JOBS,
  QUEUES,
} from '../jobs/jobs.types';
import { PrismaService } from '../prisma/prisma.service';
import { formatEmail } from './email-format';
import { MailerService } from './mailer.service';
import { WebhookDelivery } from './webhook-delivery';

type AlertJob = Job<DeliverAlertPayload | DeliverEmailPayload>;

@Processor(QUEUES.ALERTS, { concurrency: 5 })
export class AlertsWorker extends WorkerHost {
  private readonly logger = new Logger(AlertsWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly delivery: WebhookDelivery,
    private readonly mailer: MailerService,
  ) {
    super();
  }

  async process(job: AlertJob): Promise<void> {
    if (job.name === JOBS.DELIVER_EMAIL) {
      await this.deliverEmail(job as Job<DeliverEmailPayload>);
      return;
    }
    await this.deliverWebhook(job as Job<DeliverAlertPayload>);
  }

  private async deliverWebhook(job: Job<DeliverAlertPayload>): Promise<void> {
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

  private async deliverEmail(job: Job<DeliverEmailPayload>): Promise<void> {
    const { emailAlertId, payload } = job.data;
    const alert = await this.prisma.emailAlert.findUnique({
      where: { id: emailAlertId },
      select: { email: true },
    });
    if (!alert) {
      return;
    }
    const { subject, text, html } = formatEmail(payload);
    await this.mailer.send(alert.email, subject, text, html);
    this.logger.debug(`delivered ${payload.event} to email ${emailAlertId}`);
  }
}
