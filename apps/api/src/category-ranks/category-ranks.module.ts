import { Module } from '@nestjs/common';
import { StoreProvidersModule } from '../store-providers/store-providers.module';
import { CategoryRanksService } from './category-ranks.service';

@Module({
  imports: [StoreProvidersModule],
  providers: [CategoryRanksService],
  exports: [CategoryRanksService],
})
export class CategoryRanksModule {}
