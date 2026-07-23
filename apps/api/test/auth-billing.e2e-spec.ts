import './helpers/enable-billing';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { AuthUser } from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { obliterateQueues, pauseQueues } from './obliterate-queues';
import { DEFAULT_WORKSPACE_ID } from '../src/common/workspace';
import { PrismaService } from '../src/prisma/prisma.service';
import { restoreAuthEnv } from './helpers/auth-env';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('Auth (billing mode)', () => {
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
    app = moduleFixture.createNestApplication<App>();
    app.use(cookieParser());
    await app.init();
    await pauseQueues(app);

    prisma = app.get(PrismaService);
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await obliterateQueues(app);
    await app.close();
    restoreAuthEnv();
  });

  it('keeps registration open and stamps a seven day trial', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'first@example.com', password: 'supersecret1' })
      .expect(201);

    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'second@example.com', password: 'supersecret1' })
      .expect(201);
    const created = register.body as AuthUser;

    expect(created.trialEndsAt).not.toBeNull();
    const trialEndsAt = new Date(created.trialEndsAt as string).getTime();
    expect(Math.abs(trialEndsAt - (Date.now() + 7 * DAY_MS))).toBeLessThan(
      60 * 1000,
    );
    expect(created.entitled).toBe(true);
  });
});
