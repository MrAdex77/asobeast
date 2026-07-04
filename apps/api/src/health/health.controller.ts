import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { HealthStatus } from '@asobeast/shared';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<HealthStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        db: 'down',
      } satisfies HealthStatus);
    }

    return { status: 'ok', db: 'up' };
  }
}
