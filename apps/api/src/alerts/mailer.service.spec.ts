import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env';
import { MailerService } from './mailer.service';

const sendMail = jest.fn();
const createTransport = jest.fn(() => ({ sendMail }));

jest.mock('nodemailer', () => ({
  createTransport: (...args: unknown[]) => createTransport(...args),
}));

type Values = Partial<Record<keyof Env, unknown>>;

const buildConfig = (values: Values): ConfigService<Env, true> =>
  ({
    get: jest.fn((key: keyof Env) => values[key]),
  }) as unknown as ConfigService<Env, true>;

describe('MailerService', () => {
  beforeEach(() => {
    sendMail.mockReset().mockResolvedValue(undefined);
    createTransport.mockClear();
  });

  it('is disabled without SMTP_HOST and SMTP_FROM', () => {
    const mailer = new MailerService(buildConfig({}));
    expect(mailer.enabled).toBe(false);
  });

  it('is enabled once host and from are set', () => {
    const mailer = new MailerService(
      buildConfig({ SMTP_HOST: 'localhost', SMTP_FROM: 'a@b.c' }),
    );
    expect(mailer.enabled).toBe(true);
  });

  it('throws a descriptive error when disabled', async () => {
    const mailer = new MailerService(buildConfig({ SMTP_HOST: 'localhost' }));
    await expect(
      mailer.send('to@x.c', 'Hi', 'body', '<p>body</p>'),
    ).rejects.toThrow('Email alerts require SMTP configuration');
    expect(createTransport).not.toHaveBeenCalled();
  });

  it('sends through a lazily created singleton transport', async () => {
    const mailer = new MailerService(
      buildConfig({
        SMTP_HOST: 'localhost',
        SMTP_PORT: 587,
        SMTP_SECURE: false,
        SMTP_USER: 'user',
        SMTP_PASSWORD: 'pass',
        SMTP_FROM: 'alerts@x.c',
      }),
    );

    await mailer.send('to@x.c', 'Subject', 'text', '<p>text</p>');
    await mailer.send('to2@x.c', 'Subject2', 'text2', '<p>text2</p>');

    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(createTransport).toHaveBeenCalledWith({
      host: 'localhost',
      port: 587,
      secure: false,
      auth: { user: 'user', pass: 'pass' },
    });
    expect(sendMail).toHaveBeenCalledWith({
      from: 'alerts@x.c',
      to: 'to@x.c',
      subject: 'Subject',
      text: 'text',
      html: '<p>text</p>',
    });
  });

  it('propagates transport errors so callers can retry', async () => {
    sendMail.mockRejectedValue(new Error('smtp down'));
    const mailer = new MailerService(
      buildConfig({ SMTP_HOST: 'localhost', SMTP_FROM: 'alerts@x.c' }),
    );
    await expect(mailer.send('to@x.c', 's', 't', '<p>t</p>')).rejects.toThrow(
      'smtp down',
    );
  });
});
