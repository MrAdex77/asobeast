import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Response } from 'express';
import { InvalidStoreUrlError } from '@asobeast/shared';
import {
  StoreNotSupportedError,
  StoreRequestError,
} from '../store-providers/errors';

const UNSUPPORTED_MESSAGE =
  'Google Play support is planned; asobeast currently tracks App Store apps only';

@Catch(InvalidStoreUrlError, StoreNotSupportedError, StoreRequestError)
export class StoreErrorFilter implements ExceptionFilter {
  catch(
    error: InvalidStoreUrlError | StoreNotSupportedError | StoreRequestError,
    host: ArgumentsHost,
  ): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (error instanceof InvalidStoreUrlError) {
      response.status(400).json({ statusCode: 400, message: error.message });
      return;
    }

    if (error instanceof StoreNotSupportedError) {
      response
        .status(501)
        .json({ statusCode: 501, message: UNSUPPORTED_MESSAGE });
      return;
    }

    response.status(502).json({
      statusCode: 502,
      store: error.store,
      message: error.message,
    });
  }
}
