import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppSummary } from '@asobeast/shared';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@Controller('apps')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get(':id/summary')
  @ApiOperation({ summary: 'Dashboard summary for an app' })
  getSummary(@Param('id') id: string): Promise<AppSummary> {
    return this.analytics.summary(id);
  }
}
