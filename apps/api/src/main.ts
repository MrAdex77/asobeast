import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { SUPPORTED_STORES } from '@asobeast/shared';
import { AppModule } from './app.module';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Proves the compiled @asobeast/shared package is consumed by the API.
  Logger.log(`Supported stores: ${SUPPORTED_STORES.join(', ')}`, 'Bootstrap');

  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();
