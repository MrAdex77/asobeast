import { Module } from '@nestjs/common';
import { StoreProvidersModule } from '../store-providers/store-providers.module';
import { KeywordsController } from './keywords.controller';
import { KeywordsService } from './keywords.service';

@Module({
  imports: [StoreProvidersModule],
  controllers: [KeywordsController],
  providers: [KeywordsService],
  exports: [KeywordsService],
})
export class KeywordsModule {}
