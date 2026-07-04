import { Module } from '@nestjs/common';
import { KeywordsModule } from '../keywords/keywords.module';
import { StoreProvidersModule } from '../store-providers/store-providers.module';
import { AppsController } from './apps.controller';
import { AppsService } from './apps.service';

@Module({
  imports: [StoreProvidersModule, KeywordsModule],
  controllers: [AppsController],
  providers: [AppsService],
})
export class AppsModule {}
