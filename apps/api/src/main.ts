import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { SUPPORTED_STORES } from '@asobeast/shared';
import { AppModule } from './app.module';
import type { Env } from './config/env';

type JsonSerializableBigInt = { toJSON: () => number };
(BigInt.prototype as unknown as JsonSerializableBigInt).toJSON = function (
  this: bigint,
) {
  return Number(this);
};

const { version } = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf8'),
) as { version: string };

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors();
  app.use(cookieParser());

  const config = app.get(ConfigService<Env, true>);
  if (config.get('TRUST_PROXY', { infer: true })) {
    app.set('trust proxy', true);
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle('asobeast API')
    .setDescription('Self hosted ASO toolkit API')
    .setVersion(version)
    .build();
  SwaggerModule.setup('docs', app, () =>
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  // Proves the compiled @asobeast/shared package is consumed by the API.
  Logger.log(`Supported stores: ${SUPPORTED_STORES.join(', ')}`, 'Bootstrap');

  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();
