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
import { AppDetail, AppListItem, SnapshotDiffResult } from '@asobeast/shared';
import { AppsService } from './apps.service';
import { ImportAppDto } from './dto/import-app.dto';
import { StoreErrorFilter } from './store-error.filter';

@Controller('apps')
@UseFilters(StoreErrorFilter)
export class AppsController {
  constructor(private readonly apps: AppsService) {}

  @Post()
  import(@Body() dto: ImportAppDto): Promise<AppDetail> {
    return this.apps.importFromUrl(dto.url);
  }

  @Get()
  list(): Promise<AppListItem[]> {
    return this.apps.list();
  }

  @Get(':id')
  detail(@Param('id') id: string): Promise<AppDetail> {
    return this.apps.detail(id);
  }

  @Post(':id/refresh')
  @HttpCode(200)
  refresh(@Param('id') id: string): Promise<SnapshotDiffResult> {
    return this.apps.refreshApp(id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string): Promise<void> {
    return this.apps.remove(id);
  }
}
