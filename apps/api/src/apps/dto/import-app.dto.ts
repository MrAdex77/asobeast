import { IsNotEmpty, IsString } from 'class-validator';

export class ImportAppDto {
  @IsString()
  @IsNotEmpty()
  url!: string;
}
