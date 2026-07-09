import { Module } from '@nestjs/common';
import { KeywordsModule } from '../keywords/keywords.module';
import { MetadataController } from './metadata.controller';
import { MetadataService } from './metadata.service';

@Module({
  imports: [KeywordsModule],
  controllers: [MetadataController],
  providers: [MetadataService],
})
export class MetadataModule {}
