import './helpers/enable-auth';
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

function sessionCookie(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = raw?.find((entry) => entry.startsWith('asobeast_session='));
  if (!cookie) throw new Error('no session cookie set');
  return cookie.split(';')[0];
}

describe('Auth (enabled, self-hosted)', () => {
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

  it('bootstraps the first account, sets a cookie and resolves me', async () => {
    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'Owner@Example.com', password: 'supersecret1' })
      .expect(201);
    const created = register.body as AuthUser;
    expect(created.email).toBe('owner@example.com');
    expect(created.role).toBe('owner');
    expect(created.entitled).toBe(true);

    const cookie = sessionCookie(register);
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie)
      .expect(200);
    expect((me.body as AuthUser).email).toBe('owner@example.com');
  });

  it('closes registration after the first user', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'first@example.com', password: 'supersecret1' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'second@example.com', password: 'supersecret1' })
      .expect(403);
  });

  it('returns a uniform 401 for a wrong password', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'login@example.com', password: 'supersecret1' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'login@example.com', password: 'wrongpassword' })
      .expect(401);
  });

  it('logout drops the session so me is unauthorized', async () => {
    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'logout@example.com', password: 'supersecret1' })
      .expect(201);
    const cookie = sessionCookie(register);

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie)
      .expect(200);

    await request(app.getHttpServer()).post('/auth/logout').expect(204);

    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('serves the public status route', async () => {
    const status = await request(app.getHttpServer())
      .get('/auth/status')
      .expect(200);
    expect(status.body).toMatchObject({
      enabled: true,
      billing: false,
      authenticated: false,
    });
  });

  it('throttles repeated login attempts', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'hammer@example.com', password: 'supersecret1' })
      .expect(201);

    let last = 200;
    for (let i = 0; i < 12; i += 1) {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'hammer@example.com', password: 'supersecret1' });
      last = res.status;
    }
    expect(last).toBe(429);
  });
});
