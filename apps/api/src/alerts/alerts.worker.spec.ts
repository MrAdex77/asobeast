import { Job } from 'bullmq';
import { MetadataChangedPayload } from '@asobeast/shared';
import { DeliverAlertPayload } from '../jobs/jobs.types';
import { PrismaService } from '../prisma/prisma.service';
import { AlertsWorker } from './alerts.worker';
import { WebhookDelivery } from './webhook-delivery';

const payload: MetadataChangedPayload = {
  event: 'metadata.changed',
  occurredAt: '2026-07-11T00:00:00.000Z',
  app: { id: 'app_1', name: 'Mine', isCompetitor: false },
  changes: [{ field: 'title', before: 'A', after: 'B' }],
};

function makeJob(webhookId: string): Job<DeliverAlertPayload> {
  return {
    data: { webhookId, payload },
  } as unknown as Job<DeliverAlertPayload>;
}

describe('AlertsWorker', () => {
  const findUnique = jest.fn();
  const fetchMock = jest.fn();
  let worker: AlertsWorker;

  beforeEach(() => {
    findUnique.mockReset();
    fetchMock.mockReset();
    global.fetch = fetchMock;
    const prisma = { webhook: { findUnique } } as unknown as PrismaService;
    worker = new AlertsWorker(prisma, new WebhookDelivery());
  });

  it('posts the payload and signs it when the webhook has a secret', async () => {
    findUnique.mockResolvedValue({
      url: 'https://hooks.test/x',
      secret: 'topsecret',
    });
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    await worker.process(makeJob('wh_1'));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://hooks.test/x');
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Asobeast-Event']).toBe('metadata.changed');
    expect(headers['X-Asobeast-Signature']).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it('omits the signature header without a secret', async () => {
    findUnique.mockResolvedValue({ url: 'https://hooks.test/x', secret: null });
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    await worker.process(makeJob('wh_1'));

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers).not.toHaveProperty('X-Asobeast-Signature');
  });

  it('throws so bullmq retries when the endpoint returns a non-2xx', async () => {
    findUnique.mockResolvedValue({ url: 'https://hooks.test/x', secret: null });
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    await expect(worker.process(makeJob('wh_1'))).rejects.toThrow();
  });

  it('completes silently when the webhook was deleted mid-flight', async () => {
    findUnique.mockResolvedValue(null);

    await expect(worker.process(makeJob('wh_1'))).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
