import { Controller, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ScoreEnqueueResult } from '@asobeast/shared';
import { PipelineService } from './pipeline.service';

@ApiTags('scoring')
@Controller('keywords')
export class ScoringController {
  constructor(private readonly pipeline: PipelineService) {}

  @Post(':keywordId/score')
  @HttpCode(202)
  @ApiOperation({ summary: 'Enqueue an on demand keyword score' })
  async score(
    @Param('keywordId') keywordId: string,
  ): Promise<ScoreEnqueueResult> {
    await this.pipeline.enqueueScore(keywordId);
    return { enqueued: true };
  }
}
