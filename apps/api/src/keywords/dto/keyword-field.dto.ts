import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class KeywordFieldDto {
  @ApiProperty({ example: 'habit,tracker,streak,daily goals' })
  @IsString()
  text!: string;
}
