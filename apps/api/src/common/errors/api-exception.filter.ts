import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { ErrorCode, ErrorResponse } from '@courtly/contracts';
import type { Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { z } from 'zod';
import { isBookingOverlapError } from '../../prisma/prisma-errors';
import { ApiException, ERROR_STATUS } from './api.exception';

// The one place that builds the error envelope. The order of the checks
// matters: the most specific exception types come first.
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const body = this.toErrorResponse(exception);
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(body.statusCode)
      .json(body);
  }

  private toErrorResponse(exception: unknown): ErrorResponse {
    if (exception instanceof ApiException) {
      return envelope(exception.code, exception.message);
    }

    if (exception instanceof ZodValidationException) {
      const error = exception.getZodError();
      const details =
        error instanceof z.ZodError
          ? error.issues.map((issue) => ({
              path: issue.path.map(String).join('.'),
              message: issue.message,
            }))
          : undefined;
      return envelope('VALIDATION_FAILED', 'The request is not valid', details);
    }

    if (isBookingOverlapError(exception)) {
      return envelope('SLOT_TAKEN', 'That time slot is already booked');
    }

    if (exception instanceof HttpException) {
      switch (exception.getStatus()) {
        case 400:
          // Malformed JSON, for example. The parser's message is not shown.
          return envelope('VALIDATION_FAILED', 'The request is malformed');
        case 401:
          return envelope('UNAUTHENTICATED', 'Authentication is required');
        case 403:
          return envelope('FORBIDDEN', 'You are not allowed to do this');
        case 404:
          return envelope('NOT_FOUND', 'Not found');
      }
    }

    this.logUnexpected(exception);
    return envelope('INTERNAL_ERROR', 'Something went wrong');
  }

  private logUnexpected(exception: unknown): void {
    // A Prisma error message can contain the query arguments, which include
    // a password hash on the login query. Log only what identifies the error.
    if (
      exception instanceof Error &&
      exception.name.startsWith('PrismaClient')
    ) {
      const code = 'code' in exception ? String(exception.code) : '-';
      this.logger.error(`${exception.name} ${code}`);
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    } else {
      this.logger.error('Non-error value thrown');
    }
  }
}

function envelope(
  code: ErrorCode,
  message: string,
  details?: ErrorResponse['details'],
): ErrorResponse {
  const response: ErrorResponse = {
    statusCode: ERROR_STATUS[code],
    code,
    message,
  };
  if (details) {
    response.details = details;
  }
  return response;
}
