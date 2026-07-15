import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LinkAppDto {
  @ApiProperty({ example: 'clx0abcd1234' })
  @IsString()
  @IsNotEmpty()
  appId!: string;
}
