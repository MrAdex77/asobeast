import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { obliterateQueues } from './obliterate-queues';

const ROUTE = '/admin/queues';
const basic = (user: string, password: string): string =>
  `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;

describe('Bull Board basic auth (e2e)', () => {
  let app: INestApplication<App>;
  const original = {
    user: process.env.BULL_BOARD_USER,
    password: process.env.BULL_BOARD_PASSWORD,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    process.env.BULL_BOARD_USER = original.user;
    process.env.BULL_BOARD_PASSWORD = original.password;
    await obliterateQueues(app);
    await app.close();
  });

  describe('with credentials configured', () => {
    beforeEach(() => {
      process.env.BULL_BOARD_USER = 'admin';
      process.env.BULL_BOARD_PASSWORD = 's3cret';
    });

    it('rejects a request with no credentials', async () => {
      const res = await request(app.getHttpServer()).get(ROUTE).expect(401);
      expect(res.headers['www-authenticate']).toBe('Basic realm="asobeast"');
    });

    it('rejects wrong credentials', async () => {
      await request(app.getHttpServer())
        .get(ROUTE)
        .set('Authorization', basic('admin', 'nope'))
        .expect(401);
    });

    it('allows correct credentials', async () => {
      await request(app.getHttpServer())
        .get(ROUTE)
        .set('Authorization', basic('admin', 's3cret'))
        .expect(200);
    });
  });

  describe('with credentials unset', () => {
    beforeEach(() => {
      delete process.env.BULL_BOARD_USER;
      delete process.env.BULL_BOARD_PASSWORD;
    });

    it('leaves the board open', async () => {
      await request(app.getHttpServer()).get(ROUTE).expect(200);
    });
  });
});
