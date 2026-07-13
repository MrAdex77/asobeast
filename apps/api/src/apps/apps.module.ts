import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ChangesModule } from '../changes/changes.module';
import { QUEUES } from '../jobs/jobs.types';
import { KeywordsModule } from '../keywords/keywords.module';
import { StoreProvidersModule } from '../store-providers/store-providers.module';
import { AppsController } from './apps.controller';
import { AppsService } from './apps.service';

@Module({
  imports: [
    StoreProvidersModule,
    KeywordsModule,
    ChangesModule,
    BullModule.registerQueue({ name: QUEUES.APP_STORE }),
  ],
  controllers: [AppsController],
  providers: [AppsService],
  exports: [AppsService],
})
export class AppsModule {}
