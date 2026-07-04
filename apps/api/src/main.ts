import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SUPPORTED_STORES } from '@asobeast/shared';
import { AppModule } from './app.module';

type JsonSerializableBigInt = { toJSON: () => number };
(BigInt.prototype as unknown as JsonSerializableBigInt).toJSON = function (
  this: bigint,
) {
  return Number(this);
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Proves the compiled @asobeast/shared package is consumed by the API.
  Logger.log(`Supported stores: ${SUPPORTED_STORES.join(', ')}`, 'Bootstrap');

  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();
