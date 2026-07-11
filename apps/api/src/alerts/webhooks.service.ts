import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { WebhookItem } from '@asobeast/shared';
import { DEFAULT_WORKSPACE_ID } from '../common/workspace';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { toWebhookItem } from './webhooks.mapper';

@Injectable()
export class WebhooksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<WebhookItem[]> {
    const webhooks = await this.prisma.webhook.findMany({
      where: { workspaceId: DEFAULT_WORKSPACE_ID },
      orderBy: { createdAt: 'desc' },
    });
    return webhooks.map(toWebhookItem);
  }

  async create(dto: CreateWebhookDto): Promise<WebhookItem> {
    const webhook = await this.prisma.webhook.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        url: dto.url,
        events: dto.events,
        secret: dto.secret ?? null,
      },
    });
    return toWebhookItem(webhook);
  }

  async update(id: string, dto: UpdateWebhookDto): Promise<WebhookItem> {
    const data: Prisma.WebhookUpdateInput = {};
    if (dto.url !== undefined) {
      data.url = dto.url;
    }
    if (dto.events !== undefined) {
      data.events = dto.events;
    }
    if (dto.active !== undefined) {
      data.active = dto.active;
    }
    if (dto.secret !== undefined) {
      data.secret = dto.secret === '' ? null : dto.secret;
    }

    const webhook = await this.prisma.webhook.update({
      where: { id, workspaceId: DEFAULT_WORKSPACE_ID },
      data,
    });
    return toWebhookItem(webhook);
  }

  async remove(id: string): Promise<void> {
    await this.prisma.webhook.delete({
      where: { id, workspaceId: DEFAULT_WORKSPACE_ID },
    });
  }
}
