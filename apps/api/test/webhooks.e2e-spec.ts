import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ApiErrorEnvelope,
  WebhookItem,
  WebhookTestResult,
} from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { obliterateQueues } from './obliterate-queues';
import { DEFAULT_WORKSPACE_ID } from '../src/common/workspace';
import { PrismaService } from '../src/prisma/prisma.service';

describe('WebhooksController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "Webhook" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await obliterateQueues(app);
    await app.close();
  });

  const server = () => app.getHttpServer();

  it('runs the full crud round trip and masks the secret', async () => {
    const created = await request(server())
      .post('/webhooks')
      .send({
        url: 'https://hooks.example.com/asobeast',
        events: ['metadata.changed', 'rank.dropped'],
        secret: 'supersecret',
      })
      .expect(201);

    const webhook = created.body as WebhookItem;
    expect(webhook.hasSecret).toBe(true);
    expect(webhook).not.toHaveProperty('secret');
    expect(webhook.active).toBe(true);
    expect(webhook.events).toEqual(['metadata.changed', 'rank.dropped']);

    const listed = await request(server()).get('/webhooks').expect(200);
    expect(listed.body as WebhookItem[]).toHaveLength(1);

    const patched = await request(server())
      .patch(`/webhooks/${webhook.id}`)
      .send({ active: false, secret: '' })
      .expect(200);
    const updated = patched.body as WebhookItem;
    expect(updated.active).toBe(false);
    expect(updated.hasSecret).toBe(false);

    await request(server()).delete(`/webhooks/${webhook.id}`).expect(204);
    const empty = await request(server()).get('/webhooks').expect(200);
    expect(empty.body as WebhookItem[]).toHaveLength(0);
  });

  it('rejects an invalid url', async () => {
    await request(server())
      .post('/webhooks')
      .send({ url: 'not-a-url', events: ['metadata.changed'] })
      .expect(400);
  });

  it('rejects an unknown event name', async () => {
    await request(server())
      .post('/webhooks')
      .send({ url: 'https://hooks.example.com', events: ['nope'] })
      .expect(400);
  });

  it('returns a 404 envelope for an unknown webhook id', async () => {
    const response = await request(server())
      .patch('/webhooks/missing')
      .send({ active: false })
      .expect(404);
    const body = response.body as ApiErrorEnvelope;
    expect(body.statusCode).toBe(404);
  });

  it('delivers a sample payload through the test endpoint', async () => {
    const created = await request(server())
      .post('/webhooks')
      .send({
        url: 'https://hooks.example.com/asobeast',
        events: ['metadata.changed'],
      })
      .expect(201);
    const webhook = created.body as WebhookItem;

    const original = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    try {
      const response = await request(server())
        .post(`/webhooks/${webhook.id}/test`)
        .expect(201);
      expect(response.body as WebhookTestResult).toEqual({
        delivered: true,
        status: 200,
      });
    } finally {
      global.fetch = original;
    }
  });
});
