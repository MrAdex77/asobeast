import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { Env } from '../config/env';

@Injectable()
export class MailerService {
  private transport: Transporter | null = null;

  constructor(private readonly config: ConfigService<Env, true>) {}

  get enabled(): boolean {
    return Boolean(
      this.config.get('SMTP_HOST', { infer: true }) &&
      this.config.get('SMTP_FROM', { infer: true }),
    );
  }

  async send(
    to: string,
    subject: string,
    text: string,
    html: string,
  ): Promise<void> {
    if (!this.enabled) {
      throw new Error('Email alerts require SMTP configuration');
    }
    await this.transporter().sendMail({
      from: this.config.get('SMTP_FROM', { infer: true }),
      to,
      subject,
      text,
      html,
    });
  }

  private transporter(): Transporter {
    if (!this.transport) {
      const user = this.config.get('SMTP_USER', { infer: true });
      const pass = this.config.get('SMTP_PASSWORD', { infer: true });
      this.transport = createTransport({
        host: this.config.get('SMTP_HOST', { infer: true }),
        port: this.config.get('SMTP_PORT', { infer: true }),
        secure: this.config.get('SMTP_SECURE', { infer: true }),
        auth: user ? { user, pass } : undefined,
      });
    }
    return this.transport;
  }
}
