import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AlertDeliveryItem, AlertsConfig } from '@asobeast/shared';
import { AlertDeliveriesService } from './alert-deliveries.service';
import { ListDeliveriesQueryDto } from './dto/list-deliveries-query.dto';
import { MailerService } from './mailer.service';

@ApiTags('alerts')
@Controller('alerts')
export class AlertsController {
  constructor(
    private readonly mailer: MailerService,
    private readonly deliveries: AlertDeliveriesService,
  ) {}

  @Get('config')
  @ApiOperation({ summary: 'Probe which alert channels are available' })
  config(): AlertsConfig {
    return { emailEnabled: this.mailer.enabled };
  }

  @Get('deliveries')
  @ApiOperation({ summary: 'List recent alert deliveries for one channel' })
  listDeliveries(
    @Query() query: ListDeliveriesQueryDto,
  ): Promise<AlertDeliveryItem[]> {
    return this.deliveries.list(query);
  }
}
