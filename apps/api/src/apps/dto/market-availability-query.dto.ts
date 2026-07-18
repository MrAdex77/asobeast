import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class MarketAvailabilityQueryDto {
  @ApiProperty({ example: 'de' })
  @Matches(/^[a-z]{2}$/)
  country!: string;
}
