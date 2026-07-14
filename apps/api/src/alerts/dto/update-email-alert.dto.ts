import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
} from 'class-validator';
import { WEBHOOK_EVENTS, WebhookEvent } from '@asobeast/shared';

export class UpdateEmailAlertDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(WEBHOOK_EVENTS, { each: true })
  events?: WebhookEvent[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
