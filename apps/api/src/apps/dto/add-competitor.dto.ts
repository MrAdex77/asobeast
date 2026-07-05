import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AddCompetitorDto {
  @ApiProperty({
    example: 'https://apps.apple.com/us/app/rival-app/id1234567890',
  })
  @IsString()
  @IsNotEmpty()
  url!: string;
}
