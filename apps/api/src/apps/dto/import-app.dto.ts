import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ImportAppDto {
  @ApiProperty({
    example: 'https://apps.apple.com/us/app/things-3/id904237743',
  })
  @IsString()
  @IsNotEmpty()
  url!: string;
}
