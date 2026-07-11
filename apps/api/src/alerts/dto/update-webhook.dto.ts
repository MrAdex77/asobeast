import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { WEBHOOK_EVENTS, WebhookEvent } from '@asobeast/shared';

export class UpdateWebhookDto {
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(WEBHOOK_EVENTS, { each: true })
  events?: WebhookEvent[];

  @IsOptional()
  @ValidateIf((dto: UpdateWebhookDto) => dto.secret !== '')
  @IsString()
  @MinLength(8)
  secret?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
