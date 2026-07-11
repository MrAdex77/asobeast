import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AlertPayload } from '@asobeast/shared';
import { DEFAULT_WORKSPACE_ID } from '../common/workspace';
import { DeliverAlertPayload, JOBS, QUEUES } from '../jobs/jobs.types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AlertsDispatcher {
  private readonly logger = new Logger(AlertsDispatcher.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.ALERTS)
    private readonly queue: Queue<DeliverAlertPayload>,
  ) {}

  async dispatch(payload: AlertPayload): Promise<void> {
    try {
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
    } catch (error) {
      this.logger.warn(`alert dispatch failed: ${(error as Error).message}`);
    }
  }
}
