import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { RankDroppedPayload } from '@asobeast/shared';
import { DEFAULT_WORKSPACE_ID } from '../common/workspace';
import { Env } from '../config/env';
import { DeliverAlertPayload, DeliverEmailPayload } from '../jobs/jobs.types';
import { PrismaService } from '../prisma/prisma.service';
import { AlertsDispatcher } from './alerts.dispatcher';
import { MailerService } from './mailer.service';

const rankPayload: RankDroppedPayload = {
  event: 'rank.dropped',
  occurredAt: '2026-07-22T10:00:00.000Z',
  app: { id: 'app1', name: 'App One' },
  keyword: { id: 'kw1', text: 'game' },
  from: 3,
  to: 12,
  threshold: 5,
};

const buildConfig = (delivery: 'batched' | 'instant') =>
  ({
    get: jest.fn(() => delivery),
  }) as unknown as ConfigService<Env, true>;

const buildPrisma = () => ({
  alertEvent: { upsert: jest.fn().mockResolvedValue({}) },
  webhook: { findMany: jest.fn().mockResolvedValue([]) },
  emailAlert: { findMany: jest.fn().mockResolvedValue([]) },
});

const buildQueue = () => {
  const add = jest.fn().mockResolvedValue({});
  const queue = { add } as unknown as Queue<
    DeliverAlertPayload | DeliverEmailPayload
  >;
  return { add, queue };
};

describe('AlertsDispatcher', () => {
  it('collects into the outbox in batched mode', async () => {
    const prisma = buildPrisma();
    const { add, queue } = buildQueue();
    const dispatcher = new AlertsDispatcher(
      prisma as unknown as PrismaService,
      { enabled: true } as MailerService,
      buildConfig('batched'),
      queue,
    );

    await dispatcher.dispatch(rankPayload);

    expect(prisma.alertEvent.upsert).toHaveBeenCalledTimes(1);
    const [args] = prisma.alertEvent.upsert.mock.calls[0] as [
      {
        where: {
          workspaceId_dedupeKey: { workspaceId: string; dedupeKey: string };
        };
        update: {
          event: string;
          appId: string | null;
          payload: RankDroppedPayload;
        };
      },
    ];
    expect(args.where).toEqual({
      workspaceId_dedupeKey: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        dedupeKey: 'rank:app1:kw1:2026-07-22',
      },
    });
    expect(args.update).toEqual({
      event: 'rank.dropped',
      appId: 'app1',
      payload: rankPayload,
    });
    expect(add).not.toHaveBeenCalled();
  });

  it('bypasses the outbox for the weekly digest', async () => {
    const prisma = buildPrisma();
    const { queue } = buildQueue();
    const dispatcher = new AlertsDispatcher(
      prisma as unknown as PrismaService,
      { enabled: false } as MailerService,
      buildConfig('batched'),
      queue,
    );

    await dispatcher.dispatch({
      event: 'digest.weekly',
      occurredAt: '2026-07-22T10:00:00.000Z',
      window: { from: '2026-07-15', to: '2026-07-22' },
      apps: [],
      groups: [],
    } as never);

    expect(prisma.alertEvent.upsert).not.toHaveBeenCalled();
    expect(prisma.webhook.findMany).toHaveBeenCalledTimes(1);
  });

  it('delivers per event in instant mode', async () => {
    const prisma = buildPrisma();
    const { queue } = buildQueue();
    const dispatcher = new AlertsDispatcher(
      prisma as unknown as PrismaService,
      { enabled: false } as MailerService,
      buildConfig('instant'),
      queue,
    );

    await dispatcher.dispatch(rankPayload);

    expect(prisma.alertEvent.upsert).not.toHaveBeenCalled();
    expect(prisma.webhook.findMany).toHaveBeenCalledTimes(1);
  });
});
