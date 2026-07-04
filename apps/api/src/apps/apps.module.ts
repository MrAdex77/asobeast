import { Module } from '@nestjs/common';
import { StoreProvidersModule } from '../store-providers/store-providers.module';
import { AppsController } from './apps.controller';
import { AppsService } from './apps.service';

@Module({
  imports: [StoreProvidersModule],
  controllers: [AppsController],
  providers: [AppsService],
})
export class AppsModule {}
