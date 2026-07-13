import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PortfolioSummary } from '@asobeast/shared';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  @ApiOperation({ summary: 'Portfolio dashboard summary for the workspace' })
  getPortfolio(): Promise<PortfolioSummary> {
    return this.analytics.portfolio();
  }
}
