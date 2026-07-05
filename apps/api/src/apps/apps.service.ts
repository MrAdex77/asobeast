import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { App, AppSnapshot, Prisma, Store } from '@prisma/client';
import {
  AppDetail,
  AppListItem,
  CompetitorItem,
  DEFAULT_COUNTRY,
  parseStoreUrl,
  SnapshotDiffResult,
  SUPPORTED_STORES,
} from '@asobeast/shared';
import { DEFAULT_WORKSPACE_ID } from '../common/workspace';
import { KeywordsService } from '../keywords/keywords.service';
import { PrismaService } from '../prisma/prisma.service';
import { StoreNotSupportedError } from '../store-providers/errors';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { NormalizedApp } from '../store-providers/types';
import { toAppDetail, toAppListItem, toCompetitorItem } from './apps.mapper';
import { diffSnapshots } from './snapshot-diff';

const MAX_COMPETITORS = 10;

@Injectable()
export class AppsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: StoreProviderRegistry,
    private readonly keywords: KeywordsService,
  ) {}

  async importFromUrl(url: string): Promise<AppDetail> {
    const { store, storeAppId } = parseStoreUrl(url);

    if (!SUPPORTED_STORES.includes(store)) {
      throw new StoreNotSupportedError(store);
    }

    const { app, snapshot } = await this.captureApp(
      store,
      storeAppId,
      DEFAULT_COUNTRY,
    );

    await this.keywords.syncFromSnapshot(app.id);

    return toAppDetail(app, snapshot, []);
  }

  async addCompetitor(primaryId: string, url: string): Promise<CompetitorItem> {
    const primary = await this.prisma.app.findFirst({
      where: {
        id: primaryId,
        workspaceId: DEFAULT_WORKSPACE_ID,
        isCompetitor: false,
      },
      select: {
        id: true,
        store: true,
        country: true,
        _count: { select: { competitors: true } },
      },
    });

    if (!primary) {
      throw new NotFoundException(`App ${primaryId} not found`);
    }

    const { store, storeAppId } = parseStoreUrl(url);
    if (store !== primary.store) {
      throw new BadRequestException(
        'Competitor must be on the same store as the primary app',
      );
    }
    if (primary._count.competitors >= MAX_COMPETITORS) {
      throw new BadRequestException(
        `An app can have at most ${MAX_COMPETITORS} competitors`,
      );
    }

    const { app, snapshot } = await this.captureApp(
      store,
      storeAppId,
      primary.country,
      primary.id,
    );

    return toCompetitorItem(app, snapshot);
  }

  async listCompetitors(primaryId: string): Promise<CompetitorItem[]> {
    await this.ensureApp(primaryId);
    const competitors = await this.prisma.app.findMany({
      where: { primaryAppId: primaryId },
      include: { snapshots: { orderBy: { capturedAt: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'asc' },
    });
    return competitors.map((competitor) =>
      toCompetitorItem(competitor, competitor.snapshots[0] ?? null),
    );
  }

  async removeCompetitor(
    primaryId: string,
    competitorId: string,
  ): Promise<void> {
    const competitor = await this.prisma.app.findFirst({
      where: { id: competitorId, primaryAppId: primaryId },
      select: { id: true },
    });
    if (!competitor) {
      throw new NotFoundException(`Competitor ${competitorId} not found`);
    }
    await this.prisma.app.delete({ where: { id: competitor.id } });
  }

  private async captureApp(
    store: Store,
    storeAppId: string,
    country: string,
    primaryAppId?: string,
  ): Promise<{ app: App; snapshot: AppSnapshot }> {
    const normalized = await this.registry
      .get(store)
      .getApp(storeAppId, country);

    return this.prisma.$transaction(async (tx) => {
      const app = await tx.app.upsert({
        where: {
          workspaceId_store_storeAppId_country: {
            workspaceId: DEFAULT_WORKSPACE_ID,
            store,
            storeAppId,
            country,
          },
        },
        create: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          store,
          storeAppId,
          country,
          name: normalized.title,
          iconUrl: normalized.iconUrl,
          isCompetitor: primaryAppId !== undefined,
          primaryAppId,
        },
        update: {
          name: normalized.title,
          iconUrl: normalized.iconUrl,
        },
      });

      const snapshot = await tx.appSnapshot.create({
        data: this.toSnapshotData(app.id, normalized),
      });

      return { app, snapshot };
    });
  }

  async list(): Promise<AppListItem[]> {
    const apps = await this.prisma.app.findMany({
      where: { workspaceId: DEFAULT_WORKSPACE_ID, isCompetitor: false },
      include: {
        snapshots: { orderBy: { capturedAt: 'desc' }, take: 1 },
        _count: { select: { tracked: true, competitors: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return apps.map((app) =>
      toAppListItem(
        app,
        app.snapshots[0] ?? null,
        app._count.tracked,
        app._count.competitors,
      ),
    );
  }

  async detail(id: string): Promise<AppDetail> {
    const app = await this.prisma.app.findFirst({
      where: { id, workspaceId: DEFAULT_WORKSPACE_ID },
      include: {
        snapshots: { orderBy: { capturedAt: 'desc' }, take: 1 },
        competitors: {
          include: { snapshots: { orderBy: { capturedAt: 'desc' }, take: 1 } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!app) {
      throw new NotFoundException(`App ${id} not found`);
    }

    return toAppDetail(app, app.snapshots[0] ?? null, app.competitors);
  }

  private async ensureApp(id: string): Promise<void> {
    const app = await this.prisma.app.findFirst({
      where: { id, workspaceId: DEFAULT_WORKSPACE_ID },
      select: { id: true },
    });
    if (!app) {
      throw new NotFoundException(`App ${id} not found`);
    }
  }

  async remove(id: string): Promise<void> {
    const app = await this.prisma.app.findFirst({
      where: { id, workspaceId: DEFAULT_WORKSPACE_ID },
      select: { id: true },
    });

    if (!app) {
      throw new NotFoundException(`App ${id} not found`);
    }

    await this.prisma.app.delete({ where: { id } });
  }

  async refreshApp(id: string): Promise<SnapshotDiffResult> {
    const app = await this.prisma.app.findFirst({
      where: { id, workspaceId: DEFAULT_WORKSPACE_ID },
    });

    if (!app) {
      throw new NotFoundException(`App ${id} not found`);
    }

    const normalized = await this.registry
      .get(app.store)
      .getApp(app.storeAppId, app.country);

    const previous = await this.prisma.appSnapshot.findFirst({
      where: { appId: app.id },
      orderBy: { capturedAt: 'desc' },
    });

    const snapshot = await this.prisma.$transaction(async (tx) => {
      const created = await tx.appSnapshot.create({
        data: this.toSnapshotData(app.id, normalized),
      });
      await tx.app.update({
        where: { id: app.id },
        data: { name: normalized.title, iconUrl: normalized.iconUrl },
      });
      return created;
    });

    await this.keywords.syncFromSnapshot(app.id);

    return {
      snapshotId: snapshot.id,
      changes: diffSnapshots(previous, snapshot),
    };
  }

  private toSnapshotData(
    appId: string,
    normalized: NormalizedApp,
  ): Prisma.AppSnapshotCreateInput {
    return {
      app: { connect: { id: appId } },
      title: normalized.title,
      subtitle: normalized.subtitle,
      summary: normalized.summary,
      description: normalized.description,
      ratingAvg: normalized.ratingAvg,
      ratingCount: normalized.ratingCount,
      installs: normalized.installs,
      price: normalized.price,
      version: normalized.version,
      releasedAt: normalized.releasedAt,
      storeUpdatedAt: normalized.storeUpdatedAt,
      raw: normalized.raw as Prisma.InputJsonValue,
    };
  }
}
