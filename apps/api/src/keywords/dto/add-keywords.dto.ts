import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class AddKeywordsDto {
  @ApiProperty({ example: ['habit tracker', 'streak counter'] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  keywords!: string[];

  @ApiPropertyOptional({ example: 'pl' })
  @IsOptional()
  @Matches(/^[a-z]{2}$/)
  country?: string;
}
