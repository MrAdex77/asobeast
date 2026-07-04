import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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

  const swaggerConfig = new DocumentBuilder()
    .setTitle('asobeast API')
    .setDescription('Self hosted ASO toolkit API')
    .setVersion('0.0.1')
    .build();
  SwaggerModule.setup('docs', app, () =>
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  // Proves the compiled @asobeast/shared package is consumed by the API.
  Logger.log(`Supported stores: ${SUPPORTED_STORES.join(', ')}`, 'Bootstrap');

  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();
