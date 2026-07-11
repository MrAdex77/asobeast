import { Module } from '@nestjs/common';
import { StoreProvidersModule } from '../store-providers/store-providers.module';
import { RankingsController } from './rankings.controller';
import { RankingsService } from './rankings.service';
import { SerpController } from './serp.controller';

@Module({
  imports: [StoreProvidersModule],
  controllers: [RankingsController, SerpController],
  providers: [RankingsService],
  exports: [RankingsService],
})
export class RankingsModule {}
