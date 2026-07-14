import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DailyBudget, RunDailyResult } from '@asobeast/shared';
import { PipelineService } from './pipeline.service';

@ApiTags('jobs')
@Controller('apps')
export class JobsController {
  constructor(private readonly pipeline: PipelineService) {}

  @Post(':id/run-daily')
  @HttpCode(202)
  @ApiOperation({ summary: 'Manually run the daily pipeline for one app' })
  async runDaily(@Param('id') id: string): Promise<RunDailyResult> {
    return { enqueued: await this.pipeline.fanOutApp(id) };
  }
}

@ApiTags('jobs')
@Controller('jobs')
export class BudgetController {
  constructor(private readonly pipeline: PipelineService) {}

  @Get('budget')
  @ApiOperation({ summary: 'Estimate the daily store request budget' })
  budget(): Promise<DailyBudget> {
    return this.pipeline.estimateDailyBudget();
  }
}
