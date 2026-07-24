import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MaxLength(128)
  current!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(128)
  next!: string;
}
