import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { extractCandidates } from './extraction';

const AUTO_TRACK_LIMIT = 15;

@Injectable()
export class KeywordsService {
  constructor(private readonly prisma: PrismaService) {}

  async syncFromSnapshot(appId: string): Promise<void> {
    const app = await this.prisma.app.findUnique({
      where: { id: appId },
      select: { id: true, store: true, country: true },
    });
    if (!app) {
      return;
    }

    const snapshot = await this.prisma.appSnapshot.findFirst({
      where: { appId },
      orderBy: { capturedAt: 'desc' },
      select: { title: true, subtitle: true, summary: true },
    });
    if (!snapshot) {
      return;
    }

    const candidates = extractCandidates({
      title: snapshot.title,
      subtitle: snapshot.subtitle ?? undefined,
      summary: snapshot.summary ?? undefined,
    })
      .filter(
        (candidate) =>
          candidate.source === 'TITLE' || candidate.source === 'SUBTITLE',
      )
      .slice(0, AUTO_TRACK_LIMIT);

    for (const candidate of candidates) {
      const keyword = await this.prisma.keyword.upsert({
        where: {
          text_store_country: {
            text: candidate.text,
            store: app.store,
            country: app.country,
          },
        },
        create: {
          text: candidate.text,
          store: app.store,
          country: app.country,
        },
        update: {},
        select: { id: true },
      });

      await this.prisma.trackedKeyword.upsert({
        where: { appId_keywordId: { appId: app.id, keywordId: keyword.id } },
        create: {
          appId: app.id,
          keywordId: keyword.id,
          source: candidate.source,
          active: true,
        },
        update: {},
      });
    }
  }
}
