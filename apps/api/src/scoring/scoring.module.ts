import { Module } from '@nestjs/common';
import { StoreProvidersModule } from '../store-providers/store-providers.module';
import { StatsCollectorService } from './stats-collector.service';

@Module({
  imports: [StoreProvidersModule],
  providers: [StatsCollectorService],
  exports: [StatsCollectorService],
})
export class ScoringModule {}
