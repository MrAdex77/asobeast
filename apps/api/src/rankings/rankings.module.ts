import { Module } from '@nestjs/common';
import { StoreProvidersModule } from '../store-providers/store-providers.module';
import { RankingsService } from './rankings.service';

@Module({
  imports: [StoreProvidersModule],
  providers: [RankingsService],
  exports: [RankingsService],
})
export class RankingsModule {}
