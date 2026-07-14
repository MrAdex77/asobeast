import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AlertPayload } from '@asobeast/shared';
import { DEFAULT_WORKSPACE_ID } from '../common/workspace';
import {
  DeliverAlertPayload,
  DeliverEmailPayload,
  JOBS,
  QUEUES,
} from '../jobs/jobs.types';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from './mailer.service';

@Injectable()
export class AlertsDispatcher {
  private readonly logger = new Logger(AlertsDispatcher.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    @InjectQueue(QUEUES.ALERTS)
    private readonly queue: Queue<DeliverAlertPayload | DeliverEmailPayload>,
  ) {}

  async dispatch(payload: AlertPayload): Promise<void> {
    try {
      await Promise.all([
        this.dispatchWebhooks(payload),
        this.dispatchEmails(payload),
      ]);
    } catch (error) {
      this.logger.warn(`alert dispatch failed: ${(error as Error).message}`);
    }
  }

  private async dispatchWebhooks(payload: AlertPayload): Promise<void> {
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        active: true,
        events: { has: payload.event },
      },
      select: { id: true },
    });
    await Promise.all(
      webhooks.map((webhook) =>
        this.queue.add(JOBS.DELIVER_ALERT, {
          webhookId: webhook.id,
          payload,
        }),
      ),
    );
  }

  private async dispatchEmails(payload: AlertPayload): Promise<void> {
    if (!this.mailer.enabled) {
      this.logger.debug(`email disabled, skipping ${payload.event} fan-out`);
      return;
    }
    const alerts = await this.prisma.emailAlert.findMany({
      where: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        active: true,
        events: { has: payload.event },
      },
      select: { id: true },
    });
    await Promise.all(
      alerts.map((alert) =>
        this.queue.add(JOBS.DELIVER_EMAIL, {
          emailAlertId: alert.id,
          payload,
        }),
      ),
    );
  }
}
