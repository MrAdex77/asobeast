import { ArrayNotEmpty, IsArray, IsEmail, IsIn } from 'class-validator';
import { WEBHOOK_EVENTS, WebhookEvent } from '@asobeast/shared';

export class CreateEmailAlertDto {
  @IsEmail()
  email!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsIn(WEBHOOK_EVENTS, { each: true })
  events!: WebhookEvent[];
}
