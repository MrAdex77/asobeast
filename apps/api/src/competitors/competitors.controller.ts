import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CompetitorAnalysis } from '@asobeast/shared';
import { CompetitorsService } from './competitors.service';

@ApiTags('competitors')
@Controller('apps/:id/competitors')
export class CompetitorsController {
  constructor(private readonly competitors: CompetitorsService) {}

  @Get('analysis')
  @ApiOperation({ summary: 'Keyword gap and positioning analysis' })
  analysis(@Param('id') id: string): Promise<CompetitorAnalysis> {
    return this.competitors.analysis(id);
  }
}
