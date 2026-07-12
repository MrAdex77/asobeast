import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {}

  async prune(): Promise<Record<string, number>> {
    const now = new Date();
    const rules: [string, () => Promise<number>][] = [
      ['keywordRanking', () => this.pruneRankings(now)],
      ['serpEntry', () => this.pruneSerp(now)],
      ['categoryRank', () => this.pruneCategoryRanks(now)],
      ['changeEvent', () => this.pruneChangeEvents(now)],
      ['appSnapshot', () => this.pruneSnapshots(now)],
    ];

    const settled = await Promise.allSettled(rules.map(([, run]) => run()));

    const deleted: Record<string, number> = {};
    let failures = 0;
    settled.forEach((result, index) => {
      const [table] = rules[index];
      if (result.status === 'fulfilled') {
        deleted[table] = result.value;
        return;
      }
      failures += 1;
      this.logger.error(`retention ${table} failed`, result.reason);
    });

    if (failures === rules.length) {
      throw new Error('data retention failed for every table');
    }

    this.logger.log(`retention ${JSON.stringify(deleted)}`);
    return deleted;
  }

  private cutoff(days: number, now: Date): Date {
    const midnight = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    );
    return new Date(midnight - days * 86_400_000);
  }

  private async pruneRankings(now: Date): Promise<number> {
    const days = this.config.get('RETENTION_RANKINGS_DAYS', { infer: true });
    if (days === 0) {
      return 0;
    }
    const { count } = await this.prisma.keywordRanking.deleteMany({
      where: { date: { lt: this.cutoff(days, now) } },
    });
    return count;
  }

  private async pruneSerp(now: Date): Promise<number> {
    const days = this.config.get('RETENTION_SERP_DAYS', { infer: true });
    if (days === 0) {
      return 0;
    }
    const { count } = await this.prisma.serpEntry.deleteMany({
      where: { date: { lt: this.cutoff(days, now) } },
    });
    return count;
  }

  private async pruneCategoryRanks(now: Date): Promise<number> {
    const days = this.config.get('RETENTION_CATEGORY_RANKS_DAYS', {
      infer: true,
    });
    if (days === 0) {
      return 0;
    }
    const { count } = await this.prisma.categoryRank.deleteMany({
      where: { date: { lt: this.cutoff(days, now) } },
    });
    return count;
  }

  private async pruneChangeEvents(now: Date): Promise<number> {
    const days = this.config.get('RETENTION_CHANGE_EVENTS_DAYS', {
      infer: true,
    });
    if (days === 0) {
      return 0;
    }
    const { count } = await this.prisma.changeEvent.deleteMany({
      where: { capturedAt: { lt: this.cutoff(days, now) } },
    });
    return count;
  }

  private async pruneSnapshots(now: Date): Promise<number> {
    const days = this.config.get('RETENTION_SNAPSHOTS_DAYS', { infer: true });
    if (days === 0) {
      return 0;
    }
    const latest = await this.prisma.appSnapshot.findMany({
      distinct: ['appId'],
      orderBy: { capturedAt: 'desc' },
      select: { id: true },
    });
    const keepIds = latest.map((row) => row.id);
    const { count } = await this.prisma.appSnapshot.deleteMany({
      where: {
        capturedAt: { lt: this.cutoff(days, now) },
        id: { notIn: keepIds },
      },
    });
    return count;
  }
}
