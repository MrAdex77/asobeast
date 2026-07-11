import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  DetectedChange,
  DiffableChangeSnapshot,
  detectChanges,
} from './change-detector';

@Injectable()
export class ChangesService {
  constructor(private readonly prisma: PrismaService) {}

  async recordRefresh(
    appId: string,
    prev: DiffableChangeSnapshot | null,
    next: DiffableChangeSnapshot,
  ): Promise<DetectedChange[]> {
    const changes = detectChanges(prev, next);
    if (changes.length > 0) {
      await this.prisma.changeEvent.createMany({
        data: changes.map((change) => ({ appId, ...change })),
      });
    }
    return changes;
  }
}
