import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

const lower = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class SpiderStartDto {
  @ApiProperty({ example: 'habit tracker' })
  @Transform(lower)
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  term!: string;
}

export class SpiderQueryDto {
  @ApiProperty({ example: 'habit tracker' })
  @Transform(lower)
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  term!: string;
}
