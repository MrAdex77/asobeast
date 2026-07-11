import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { StoreProvidersModule } from '../store-providers/store-providers.module';
import { RankingsController } from './rankings.controller';
import { RankingsService } from './rankings.service';
import { SerpController } from './serp.controller';

@Module({
  imports: [StoreProvidersModule, AlertsModule],
  controllers: [RankingsController, SerpController],
  providers: [RankingsService],
  exports: [RankingsService],
})
export class RankingsModule {}
