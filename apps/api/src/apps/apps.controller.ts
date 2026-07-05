import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseFilters,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AppDetail,
  AppListItem,
  CompetitorItem,
  SnapshotDiffResult,
} from '@asobeast/shared';
import { AppsService } from './apps.service';
import { AddCompetitorDto } from './dto/add-competitor.dto';
import { ImportAppDto } from './dto/import-app.dto';
import { StoreErrorFilter } from './store-error.filter';

@ApiTags('apps')
@Controller('apps')
@UseFilters(StoreErrorFilter)
export class AppsController {
  constructor(private readonly apps: AppsService) {}

  @Post()
  @ApiOperation({ summary: 'Import an app from a store URL' })
  import(@Body() dto: ImportAppDto): Promise<AppDetail> {
    return this.apps.importFromUrl(dto.url);
  }

  @Get()
  @ApiOperation({ summary: 'List imported apps' })
  list(): Promise<AppListItem[]> {
    return this.apps.list();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get an app with its latest snapshot and competitors',
  })
  detail(@Param('id') id: string): Promise<AppDetail> {
    return this.apps.detail(id);
  }

  @Post(':id/refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Refresh an app and return the snapshot diff' })
  refresh(@Param('id') id: string): Promise<SnapshotDiffResult> {
    return this.apps.refreshApp(id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete an app' })
  remove(@Param('id') id: string): Promise<void> {
    return this.apps.remove(id);
  }

  @Post(':id/competitors')
  @ApiOperation({ summary: 'Add a competitor app from a store URL' })
  addCompetitor(
    @Param('id') id: string,
    @Body() dto: AddCompetitorDto,
  ): Promise<CompetitorItem> {
    return this.apps.addCompetitor(id, dto.url);
  }

  @Get(':id/competitors')
  @ApiOperation({ summary: 'List competitors for an app' })
  listCompetitors(@Param('id') id: string): Promise<CompetitorItem[]> {
    return this.apps.listCompetitors(id);
  }

  @Delete(':id/competitors/:competitorId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a competitor from an app' })
  removeCompetitor(
    @Param('id') id: string,
    @Param('competitorId') competitorId: string,
  ): Promise<void> {
    return this.apps.removeCompetitor(id, competitorId);
  }
}
