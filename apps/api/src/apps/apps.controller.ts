import { Body, Controller, Post, UseFilters } from '@nestjs/common';
import { AppDetail } from '@asobeast/shared';
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
}
