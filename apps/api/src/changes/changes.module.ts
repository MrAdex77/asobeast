import { Module } from '@nestjs/common';
import { ChangesService } from './changes.service';

@Module({
  providers: [ChangesService],
  exports: [ChangesService],
})
export class ChangesModule {}
