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
import { sha256 } from '../src/auth/auth.service';
import { restoreAuthEnv } from './helpers/auth-env';

const DAY_MS = 24 * 60 * 60 * 1000;

function sessionCookie(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = raw?.find((entry) => entry.startsWith('asobeast_session='));
  if (!cookie) throw new Error('no session cookie set');
  return cookie.split(';')[0];
}

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

  const registerOwner = async (): Promise<{ cookie: string; id: string }> => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'owner@example.com', password: 'supersecret1' })
      .expect(201);
    return {
      cookie: sessionCookie(res),
      id: (res.body as AuthUser).id,
    };
  };

  it('grants a fresh trial account full access', async () => {
    const { cookie } = await registerOwner();
    await request(app.getHttpServer())
      .get('/apps')
      .set('Cookie', cookie)
      .expect(200);
  });

  it('locks a lapsed trial but keeps account routes reachable', async () => {
    const { cookie, id } = await registerOwner();
    await prisma.user.update({
      where: { id },
      data: { trialEndsAt: new Date(Date.now() - DAY_MS) },
    });

    await request(app.getHttpServer())
      .get('/apps')
      .set('Cookie', cookie)
      .expect(402);

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie)
      .expect(200);
    expect((me.body as AuthUser).entitled).toBe(false);
  });

  it('restores access when the plan is set to premium', async () => {
    const { cookie, id } = await registerOwner();
    await prisma.user.update({
      where: { id },
      data: { trialEndsAt: new Date(Date.now() - DAY_MS), plan: 'premium' },
    });

    await request(app.getHttpServer())
      .get('/apps')
      .set('Cookie', cookie)
      .expect(200);

    await prisma.user.update({
      where: { id },
      data: { planExpiresAt: new Date(Date.now() - DAY_MS) },
    });

    await request(app.getHttpServer())
      .get('/apps')
      .set('Cookie', cookie)
      .expect(402);
  });

  it('locks api-token requests from an unentitled user', async () => {
    const { id } = await registerOwner();
    await prisma.user.update({
      where: { id },
      data: { trialEndsAt: new Date(Date.now() - DAY_MS) },
    });
    const plaintext = `asob_${'b'.repeat(48)}`;
    await prisma.apiToken.create({
      data: {
        userId: id,
        name: 'ci',
        tokenHash: sha256(plaintext),
        prefix: plaintext.slice(0, 12),
      },
    });

    await request(app.getHttpServer())
      .get('/apps')
      .set('Authorization', `Bearer ${plaintext}`)
      .expect(402);
  });
});
