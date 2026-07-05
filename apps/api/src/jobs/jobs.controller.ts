import { Controller, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FanOutSummary, PipelineService } from './pipeline.service';

@ApiTags('jobs')
@Controller('apps')
export class JobsController {
  constructor(private readonly pipeline: PipelineService) {}

  @Post(':id/run-daily')
  @HttpCode(202)
  @ApiOperation({ summary: 'Manually run the daily pipeline for one app' })
  async runDaily(
    @Param('id') id: string,
  ): Promise<{ enqueued: FanOutSummary }> {
    return { enqueued: await this.pipeline.fanOutApp(id) };
  }
}
