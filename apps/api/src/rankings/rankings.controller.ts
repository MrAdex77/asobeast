import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RankingSeries } from '@asobeast/shared';
import { RankingHistoryQueryDto } from './dto/ranking-history-query.dto';
import { RankingsService } from './rankings.service';

@ApiTags('rankings')
@Controller('apps')
export class RankingsController {
  constructor(private readonly rankings: RankingsService) {}

  @Get(':id/rankings')
  @ApiOperation({ summary: 'Ranking history series for an app' })
  history(
    @Param('id') id: string,
    @Query() query: RankingHistoryQueryDto,
  ): Promise<RankingSeries> {
    return this.rankings.history(id, query);
  }
}
