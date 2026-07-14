import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AlertDeliveryItem,
  AlertsConfig,
  ApiErrorEnvelope,
  EmailAlertItem,
  WebhookTestResult,
} from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { MailerService } from '../src/alerts/mailer.service';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/workspace';
import { PrismaService } from '../src/prisma/prisma.service';
import { obliterateQueues } from './obliterate-queues';

function migrate(): void {
  execSync('pnpm prisma migrate deploy', {
    cwd: join(__dirname, '..'),
    env: process.env,
    stdio: 'ignore',
  });
}

async function seedWorkspace(prisma: PrismaService): Promise<void> {
  await prisma.workspace.upsert({
    where: { id: DEFAULT_WORKSPACE_ID },
    update: {},
    create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
  });
}

describe('EmailAlertsController (e2e, smtp enabled)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const send = jest.fn().mockResolvedValue(undefined);

  beforeAll(async () => {
    migrate();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailerService)
      .useValue({ enabled: true, send })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await seedWorkspace(prisma);
  });

  beforeEach(async () => {
    send.mockClear();
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "EmailAlert", "Webhook", "AlertDelivery" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await obliterateQueues(app);
    await app.close();
  });

  const server = () => app.getHttpServer();

  it('reports email as enabled', async () => {
    const response = await request(server()).get('/alerts/config').expect(200);
    expect(response.body as AlertsConfig).toEqual({ emailEnabled: true });
  });

  it('runs the full crud round trip', async () => {
    const created = await request(server())
      .post('/email-alerts')
      .send({
        email: 'ops@example.com',
        events: ['metadata.changed', 'rank.dropped'],
      })
      .expect(201);
    const alert = created.body as EmailAlertItem;
    expect(alert.email).toBe('ops@example.com');
    expect(alert.active).toBe(true);
    expect(alert.events).toEqual(['metadata.changed', 'rank.dropped']);

    const listed = await request(server()).get('/email-alerts').expect(200);
    expect(listed.body as EmailAlertItem[]).toHaveLength(1);

    const patched = await request(server())
      .patch(`/email-alerts/${alert.id}`)
      .send({ active: false, email: 'team@example.com' })
      .expect(200);
    const updated = patched.body as EmailAlertItem;
    expect(updated.active).toBe(false);
    expect(updated.email).toBe('team@example.com');

    await request(server()).delete(`/email-alerts/${alert.id}`).expect(204);
    const empty = await request(server()).get('/email-alerts').expect(200);
    expect(empty.body as EmailAlertItem[]).toHaveLength(0);
  });

  it('rejects an invalid email', async () => {
    await request(server())
      .post('/email-alerts')
      .send({ email: 'not-an-email', events: ['metadata.changed'] })
      .expect(400);
  });

  it('sends a sample through the test endpoint', async () => {
    const created = await request(server())
      .post('/email-alerts')
      .send({ email: 'ops@example.com', events: ['metadata.changed'] })
      .expect(201);
    const alert = created.body as EmailAlertItem;

    const response = await request(server())
      .post(`/email-alerts/${alert.id}/test`)
      .expect(201);
    expect(response.body as WebhookTestResult).toEqual({
      delivered: true,
      status: null,
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('lists deliveries filtered by a single channel', async () => {
    const alert = await prisma.emailAlert.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        email: 'ops@example.com',
        events: ['metadata.changed'],
      },
    });
    await prisma.alertDelivery.create({
      data: {
        channel: 'email',
        emailAlertId: alert.id,
        event: 'metadata.changed',
        status: 'success',
        attempt: 1,
      },
    });
    const webhook = await prisma.webhook.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        url: 'https://hooks.example.com/x',
        events: ['rank.dropped'],
      },
    });
    await prisma.alertDelivery.create({
      data: {
        channel: 'webhook',
        webhookId: webhook.id,
        event: 'rank.dropped',
        status: 'failed',
        detail: 'boom',
        attempt: 2,
      },
    });

    const byEmail = await request(server())
      .get(`/alerts/deliveries?emailAlertId=${alert.id}`)
      .expect(200);
    const emailRows = byEmail.body as AlertDeliveryItem[];
    expect(emailRows).toHaveLength(1);
    expect(emailRows[0].channel).toBe('email');
    expect(emailRows[0].status).toBe('success');

    const byWebhook = await request(server())
      .get(`/alerts/deliveries?webhookId=${webhook.id}`)
      .expect(200);
    const webhookRows = byWebhook.body as AlertDeliveryItem[];
    expect(webhookRows).toHaveLength(1);
    expect(webhookRows[0].detail).toBe('boom');
    expect(webhookRows[0].attempt).toBe(2);
  });

  it('requires exactly one channel filter', async () => {
    await request(server()).get('/alerts/deliveries').expect(400);
    await request(server())
      .get('/alerts/deliveries?webhookId=a&emailAlertId=b')
      .expect(400);
  });
});

describe('EmailAlertsController (e2e, smtp disabled)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    migrate();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailerService)
      .useValue({ enabled: false, send: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await seedWorkspace(prisma);
  });

  afterAll(async () => {
    await obliterateQueues(app);
    await app.close();
  });

  const server = () => app.getHttpServer();

  it('reports email as disabled', async () => {
    const response = await request(server()).get('/alerts/config').expect(200);
    expect(response.body as AlertsConfig).toEqual({ emailEnabled: false });
  });

  it('rejects creation with a 400 envelope', async () => {
    const response = await request(server())
      .post('/email-alerts')
      .send({ email: 'ops@example.com', events: ['metadata.changed'] })
      .expect(400);
    const body = response.body as ApiErrorEnvelope;
    expect(body.statusCode).toBe(400);
    expect(body.message).toContain('SMTP configuration');
  });
});
