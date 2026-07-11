import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SerpSnapshot } from '@asobeast/shared';
import { SerpQueryDto } from './dto/serp-query.dto';
import { RankingsService } from './rankings.service';

@ApiTags('rankings')
@Controller('keywords')
export class SerpController {
  constructor(private readonly rankings: RankingsService) {}

  @Get(':keywordId/serp')
  @ApiOperation({ summary: 'Top search results captured for a keyword' })
  serp(
    @Param('keywordId') keywordId: string,
    @Query() query: SerpQueryDto,
  ): Promise<SerpSnapshot> {
    return this.rankings.serp(keywordId, query);
  }
}
