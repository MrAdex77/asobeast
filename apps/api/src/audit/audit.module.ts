import { Module } from '@nestjs/common';
import { KeywordsModule } from '../keywords/keywords.module';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

@Module({
  imports: [KeywordsModule],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
