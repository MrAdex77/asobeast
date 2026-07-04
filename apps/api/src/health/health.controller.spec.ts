import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthController', () => {
  it('reports ok and db up when the database responds', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as unknown as PrismaService;

    const result = await new HealthController(prisma).check();

    expect(result).toEqual({ status: 'ok', db: 'up' });
  });

  it('throws 503 with db down when the database is unreachable', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('unreachable')),
    } as unknown as PrismaService;

    await expect(new HealthController(prisma).check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
