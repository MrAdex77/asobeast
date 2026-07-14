import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  EmailAlertItem,
  MetadataChangedPayload,
  WebhookTestResult,
} from '@asobeast/shared';
import { DEFAULT_WORKSPACE_ID } from '../common/workspace';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmailAlertDto } from './dto/create-email-alert.dto';
import { UpdateEmailAlertDto } from './dto/update-email-alert.dto';
import { toEmailAlertItem } from './email-alerts.mapper';
import { formatEmail } from './email-format';
import { MailerService } from './mailer.service';

const DISABLED_MESSAGE = 'Email alerts require SMTP configuration';

@Injectable()
export class EmailAlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
  ) {}

  async list(): Promise<EmailAlertItem[]> {
    const alerts = await this.prisma.emailAlert.findMany({
      where: { workspaceId: DEFAULT_WORKSPACE_ID },
      orderBy: { createdAt: 'desc' },
    });
    return alerts.map(toEmailAlertItem);
  }

  async create(dto: CreateEmailAlertDto): Promise<EmailAlertItem> {
    this.assertEnabled();
    const alert = await this.prisma.emailAlert.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        email: dto.email,
        events: dto.events,
      },
    });
    return toEmailAlertItem(alert);
  }

  async update(id: string, dto: UpdateEmailAlertDto): Promise<EmailAlertItem> {
    const data: Prisma.EmailAlertUpdateInput = {};
    if (dto.email !== undefined) {
      data.email = dto.email;
    }
    if (dto.events !== undefined) {
      data.events = dto.events;
    }
    if (dto.active !== undefined) {
      data.active = dto.active;
    }

    const alert = await this.prisma.emailAlert.update({
      where: { id, workspaceId: DEFAULT_WORKSPACE_ID },
      data,
    });
    return toEmailAlertItem(alert);
  }

  async remove(id: string): Promise<void> {
    await this.prisma.emailAlert.delete({
      where: { id, workspaceId: DEFAULT_WORKSPACE_ID },
    });
  }

  async test(id: string): Promise<WebhookTestResult> {
    this.assertEnabled();
    const alert = await this.prisma.emailAlert.findFirst({
      where: { id, workspaceId: DEFAULT_WORKSPACE_ID },
      select: { email: true },
    });
    if (!alert) {
      throw new NotFoundException(`Email alert ${id} not found`);
    }
    const { subject, text, html } = formatEmail(samplePayload());
    try {
      await this.mailer.send(alert.email, subject, text, html);
      return { delivered: true, status: null };
    } catch {
      return { delivered: false, status: null };
    }
  }

  private assertEnabled(): void {
    if (!this.mailer.enabled) {
      throw new BadRequestException(DISABLED_MESSAGE);
    }
  }
}

function samplePayload(): MetadataChangedPayload {
  return {
    event: 'metadata.changed',
    occurredAt: new Date().toISOString(),
    app: { id: 'sample', name: 'Sample App', isCompetitor: false },
    changes: [{ field: 'title', before: 'Old title', after: 'New title' }],
  };
}
