import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CompetitorAnalysis, CompetitorDiscovery } from '@asobeast/shared';
import { CompetitorsService } from './competitors.service';
import { DiscoveryQueryDto } from './dto/discovery-query.dto';

@ApiTags('competitors')
@Controller('apps/:id/competitors')
export class CompetitorsController {
  constructor(private readonly competitors: CompetitorsService) {}

  @Get('analysis')
  @ApiOperation({ summary: 'Keyword gap and positioning analysis' })
  analysis(@Param('id') id: string): Promise<CompetitorAnalysis> {
    return this.competitors.analysis(id);
  }

  @Get('discovery')
  @ApiOperation({ summary: 'Untracked apps recurring in your keyword results' })
  discovery(
    @Param('id') id: string,
    @Query() query: DiscoveryQueryDto,
  ): Promise<CompetitorDiscovery> {
    return this.competitors.discovery(id, query);
  }
}
