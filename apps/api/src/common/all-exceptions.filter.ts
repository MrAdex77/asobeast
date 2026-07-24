import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { ApiErrorEnvelope, InvalidStoreUrlError } from '@asobeast/shared';
import { EntitlementRequiredError } from '../auth/auth.errors';
import {
  StoreNotSupportedError,
  StoreRequestError,
} from '../store-providers/errors';

const GOOGLE_PLAY_MESSAGE =
  'Google Play support is planned; asobeast currently tracks App Store apps only';

type ResolvedError = Pick<ApiErrorEnvelope, 'statusCode' | 'error' | 'message'>;

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const resolved = this.resolve(exception);
    const envelope: ApiErrorEnvelope = {
      ...resolved,
      path: request.url,
      timestamp: new Date().toISOString(),
    };
    response.status(resolved.statusCode).json(envelope);
  }

  private resolve(exception: unknown): ResolvedError {
    if (exception instanceof InvalidStoreUrlError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: exception.message,
      };
    }
    if (exception instanceof StoreNotSupportedError) {
      return {
        statusCode: HttpStatus.NOT_IMPLEMENTED,
        error: 'Not Implemented',
        message: GOOGLE_PLAY_MESSAGE,
      };
    }
    if (exception instanceof StoreRequestError) {
      return {
        statusCode: HttpStatus.BAD_GATEWAY,
        error: 'Bad Gateway',
        message: exception.message,
      };
    }
    if (exception instanceof EntitlementRequiredError) {
      return {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        error: 'Payment Required',
        message: exception.message,
      };
    }
    if (
      exception instanceof Prisma.PrismaClientKnownRequestError &&
      exception.code === 'P2025'
    ) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        error: 'Not Found',
        message: 'Resource not found',
      };
    }
    if (
      exception instanceof Prisma.PrismaClientKnownRequestError &&
      exception.code === 'P2002'
    ) {
      return {
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        message: 'Resource already exists',
      };
    }
    if (exception instanceof HttpException) {
      return this.fromHttp(exception);
    }
    this.logger.error(
      'Unhandled exception',
      exception instanceof Error ? exception.stack : String(exception),
    );
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Internal server error',
    };
  }

  private fromHttp(exception: HttpException): ResolvedError {
    const statusCode = exception.getStatus();
    const body = exception.getResponse();
    if (typeof body === 'string') {
      return { statusCode, error: exception.name, message: body };
    }
    const record = body as Record<string, unknown>;
    const message = Array.isArray(record.message)
      ? record.message.join(', ')
      : typeof record.message === 'string'
        ? record.message
        : exception.message;
    const error =
      typeof record.error === 'string' ? record.error : exception.name;
    return { statusCode, error, message };
  }
}
