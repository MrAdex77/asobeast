import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppSummary, VisibilityHistory } from '@asobeast/shared';
import { AnalyticsService } from './analytics.service';
import { VisibilityHistoryQueryDto } from './dto/visibility-history-query.dto';

@ApiTags('analytics')
@Controller('apps')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get(':id/summary')
  @ApiOperation({ summary: 'Dashboard summary for an app' })
  getSummary(@Param('id') id: string): Promise<AppSummary> {
    return this.analytics.summary(id);
  }

  @Get(':id/visibility-history')
  @ApiOperation({ summary: 'Visibility score history series for an app' })
  getVisibilityHistory(
    @Param('id') id: string,
    @Query() query: VisibilityHistoryQueryDto,
  ): Promise<VisibilityHistory> {
    return this.analytics.history(id, query);
  }
}
