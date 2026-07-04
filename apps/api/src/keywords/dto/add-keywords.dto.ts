import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class AddKeywordsDto {
  @ApiProperty({ example: ['habit tracker', 'streak counter'] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  keywords!: string[];
}
