import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AppDetail,
  AppGroupSummary,
  AppListItem,
  CompetitorItem,
  MarketAvailabilityResult,
  SnapshotDiffResult,
} from '@asobeast/shared';
import { AppsService } from './apps.service';
import { AddCompetitorDto } from './dto/add-competitor.dto';
import { ImportAppDto } from './dto/import-app.dto';
import { LinkAppDto } from './dto/link-app.dto';
import { MarketAvailabilityQueryDto } from './dto/market-availability-query.dto';

@ApiTags('apps')
@Controller('apps')
export class AppsController {
  constructor(private readonly apps: AppsService) {}

  @Post()
  @ApiOperation({ summary: 'Import an app from a store URL' })
  import(@Body() dto: ImportAppDto): Promise<AppDetail> {
    return this.apps.importFromUrl(dto.url, dto.country);
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

  @Get(':id/market-availability')
  @ApiOperation({
    summary: 'Probe whether an app is published in a storefront',
  })
  marketAvailability(
    @Param('id') id: string,
    @Query() query: MarketAvailabilityQueryDto,
  ): Promise<MarketAvailabilityResult> {
    return this.apps.marketAvailability(id, query.country);
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

  @Post(':id/link')
  @ApiOperation({
    summary: 'Link an app to its counterpart on the other store',
  })
  link(
    @Param('id') id: string,
    @Body() dto: LinkAppDto,
  ): Promise<AppGroupSummary> {
    return this.apps.linkApp(id, dto.appId);
  }

  @Delete(':id/link')
  @HttpCode(204)
  @ApiOperation({ summary: 'Unlink an app from its group' })
  unlink(@Param('id') id: string): Promise<void> {
    return this.apps.unlinkApp(id);
  }

  @Post(':id/competitors')
  @ApiTags('competitors')
  @ApiOperation({ summary: 'Add a competitor app from a store URL' })
  addCompetitor(
    @Param('id') id: string,
    @Body() dto: AddCompetitorDto,
  ): Promise<CompetitorItem> {
    return this.apps.addCompetitor(id, dto.url);
  }

  @Get(':id/competitors')
  @ApiTags('competitors')
  @ApiOperation({ summary: 'List competitors for an app' })
  listCompetitors(@Param('id') id: string): Promise<CompetitorItem[]> {
    return this.apps.listCompetitors(id);
  }

  @Delete(':id/competitors/:competitorId')
  @HttpCode(204)
  @ApiTags('competitors')
  @ApiOperation({ summary: 'Remove a competitor from an app' })
  removeCompetitor(
    @Param('id') id: string,
    @Param('competitorId') competitorId: string,
  ): Promise<void> {
    return this.apps.removeCompetitor(id, competitorId);
  }
}
