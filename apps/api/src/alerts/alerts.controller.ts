import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AlertsConfig } from '@asobeast/shared';
import { MailerService } from './mailer.service';

@ApiTags('alerts')
@Controller('alerts')
export class AlertsController {
  constructor(private readonly mailer: MailerService) {}

  @Get('config')
  @ApiOperation({ summary: 'Probe which alert channels are available' })
  config(): AlertsConfig {
    return { emailEnabled: this.mailer.enabled };
  }
}
