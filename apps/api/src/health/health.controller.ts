import { InjectQueue } from '@nestjs/bullmq';
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthStatus, PipelineHealth } from '@asobeast/shared';
import { Queue } from 'bullmq';
import { LAST_DAILY_RUN_KEY, QUEUES } from '../jobs/jobs.types';
import { PrismaService } from '../prisma/prisma.service';

const STALE_MS = 26 * 60 * 60 * 1000;
const REDIS_TIMEOUT_MS = 1000;

interface PipelineSignals {
  redis: 'up' | 'down';
  pipeline: PipelineHealth | null;
}

interface RedisReader {
  ping(): Promise<string>;
  get(key: string): Promise<string | null>;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.PIPELINE) private readonly pipelineQueue: Queue,
    @InjectQueue(QUEUES.APP_STORE) private readonly appStoreQueue: Queue,
    @InjectQueue(QUEUES.GPLAY) private readonly gplayQueue: Queue,
    @InjectQueue(QUEUES.ALERTS) private readonly alertsQueue: Queue,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liveness, database and pipeline health check' })
  async check(): Promise<HealthStatus> {
    const [db, signals] = await Promise.all([
      this.pingDb(),
      this.pipelineSignals(),
    ]);

    if (db === 'down') {
      throw new ServiceUnavailableException({
        status: 'error',
        db: 'down',
        redis: signals.redis,
        pipeline: signals.pipeline,
      } satisfies HealthStatus);
    }

    return {
      status: 'ok',
      db: 'up',
      redis: signals.redis,
      pipeline: signals.pipeline,
    };
  }

  private async pingDb(): Promise<'up' | 'down'> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async pipelineSignals(): Promise<PipelineSignals> {
    try {
      return await this.withTimeout(this.readSignals(), REDIS_TIMEOUT_MS);
    } catch {
      return { redis: 'down', pipeline: null };
    }
  }

  private async readSignals(): Promise<PipelineSignals> {
    const client = (await this.pipelineQueue.client) as unknown as RedisReader;
    await client.ping();

    const [iso, appCount, appStoreFailed, gplayFailed, alertsFailed] =
      await Promise.all([
        client.get(LAST_DAILY_RUN_KEY),
        this.prisma.app.count(),
        this.appStoreQueue.getFailedCount(),
        this.gplayQueue.getFailedCount(),
        this.alertsQueue.getFailedCount(),
      ]);

    const lastDailyRunAt = iso ?? null;
    return {
      redis: 'up',
      pipeline: {
        lastDailyRunAt,
        stale: isStale(lastDailyRunAt, appCount),
        failedJobs: appStoreFailed + gplayFailed + alertsFailed,
      },
    };
  }

  private withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      work,
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error('redis timeout')), ms).unref();
      }),
    ]);
  }
}

function isStale(lastDailyRunAt: string | null, appCount: number): boolean {
  if (!lastDailyRunAt || appCount === 0) {
    return false;
  }
  return Date.now() - new Date(lastDailyRunAt).getTime() > STALE_MS;
}
