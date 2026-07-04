import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AppDetail,
  AppListItem,
  DEFAULT_COUNTRY,
  parseStoreUrl,
  SUPPORTED_STORES,
} from '@asobeast/shared';
import { DEFAULT_WORKSPACE_ID } from '../common/workspace';
import { PrismaService } from '../prisma/prisma.service';
import { StoreNotSupportedError } from '../store-providers/errors';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { NormalizedApp } from '../store-providers/types';
import { toAppDetail, toAppListItem } from './apps.mapper';

@Injectable()
export class AppsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: StoreProviderRegistry,
  ) {}

  async importFromUrl(url: string): Promise<AppDetail> {
    const { store, storeAppId } = parseStoreUrl(url);

    if (!SUPPORTED_STORES.includes(store)) {
      throw new StoreNotSupportedError(store);
    }

    const country = DEFAULT_COUNTRY;
    const normalized = await this.registry
      .get(store)
      .getApp(storeAppId, country);

    const { app, snapshot } = await this.prisma.$transaction(async (tx) => {
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

    return toAppDetail(app, snapshot, []);
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
        competitors: true,
      },
    });

    if (!app) {
      throw new NotFoundException(`App ${id} not found`);
    }

    return toAppDetail(app, app.snapshots[0] ?? null, app.competitors);
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
