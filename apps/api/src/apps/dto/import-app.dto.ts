import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class ImportAppDto {
  @ApiProperty({
    example:
      'https://apps.apple.com/us/app/where-am-i-geoguess-map-quiz/id6657987209',
  })
  @IsString()
  @IsNotEmpty()
  url!: string;

  @ApiPropertyOptional({ example: 'de' })
  @IsOptional()
  @Matches(/^[a-z]{2}$/)
  country?: string;
}
