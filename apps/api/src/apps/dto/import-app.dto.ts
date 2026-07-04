import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ImportAppDto {
  @ApiProperty({
    example:
      'https://apps.apple.com/us/app/where-am-i-geoguess-map-quiz/id6657987209',
  })
  @IsString()
  @IsNotEmpty()
  url!: string;
}
