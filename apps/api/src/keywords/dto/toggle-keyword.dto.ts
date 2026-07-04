import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ToggleKeywordDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  active!: boolean;
}
