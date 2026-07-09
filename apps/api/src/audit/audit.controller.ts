import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppAuditResult } from '@asobeast/shared';
import { AuditService } from './audit.service';
import { AuditInputAnswersDto } from './dto/audit-inputs.dto';

@ApiTags('audit')
@Controller('apps/:id/audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'ASO audit score card for an app' })
  getAudit(@Param('id') id: string): Promise<AppAuditResult> {
    return this.audit.audit(id);
  }

  @Put('inputs')
  @ApiOperation({ summary: 'Save manual audit answers and recompute' })
  saveInputs(
    @Param('id') id: string,
    @Body() dto: AuditInputAnswersDto,
  ): Promise<AppAuditResult> {
    return this.audit.saveInputs(id, dto);
  }
}
