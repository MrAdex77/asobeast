import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { computeDifficulty, computeTraffic, KeywordStats } from './formulas';
import { StatsCollectorService } from './stats-collector.service';

const toJson = (stats: KeywordStats): Prisma.InputJsonValue =>
  stats as unknown as Prisma.InputJsonValue;

function utcToday(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

@Injectable()
export class ScoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly collector: StatsCollectorService,
  ) {}

  async scoreKeyword(keywordId: string): Promise<void> {
    const stats = await this.collector.collect(keywordId);
    if (!stats) {
      return;
    }
    const traffic = computeTraffic(stats);
    const difficulty = computeDifficulty(stats);
    const date = utcToday();
    const json = toJson(stats);

    await this.prisma.keywordMetric.upsert({
      where: { keywordId_date: { keywordId, date } },
      create: { keywordId, date, traffic, difficulty, stats: json },
      update: { traffic, difficulty, stats: json },
    });
  }
}
