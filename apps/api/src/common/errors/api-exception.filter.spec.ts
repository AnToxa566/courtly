import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  UnauthorizedException,
} from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { errorResponseSchema, loginRequestSchema } from '@courtly/contracts';
import type { ErrorResponse } from '@courtly/contracts';
import { ZodValidationException } from 'nestjs-zod';
import { Prisma } from '../../generated/prisma/client';
import { ApiException } from './api.exception';
import { ApiExceptionFilter } from './api-exception.filter';

// Runs the filter against a recording response and returns what it sent.
function run(exception: unknown): ErrorResponse {
  let status = 0;
  let sent: unknown;
  const response = {
    status(code: number) {
      status = code;
      return this;
    },
    json(body: unknown) {
      sent = body;
      return this;
    },
  };
  const host = new ExecutionContextHost([{}, response, () => undefined]);

  new ApiExceptionFilter().catch(exception, host);

  const body = errorResponseSchema.parse(sent);
  expect(body.statusCode).toBe(status);
  return body;
}

function prismaError(
  code: string,
  originalCode: string,
  originalMessage: string,
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('secret query text', {
    code,
    clientVersion: 'test',
    meta: { driverAdapterError: { cause: { originalCode, originalMessage } } },
  });
}

describe('ApiExceptionFilter', () => {
  let logged: jest.SpyInstance;

  beforeEach(() => {
    logged = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders an ApiException with its code, status and message', () => {
    expect(run(new ApiException('BOOKING_IN_PAST', 'Too late'))).toEqual({
      statusCode: 422,
      code: 'BOOKING_IN_PAST',
      message: 'Too late',
    });
  });

  it('renders the details an ApiException carries', () => {
    const details = [
      { path: 'closesAt', message: 'closesAt must be after opensAt' },
    ];

    expect(
      run(new ApiException('VALIDATION_FAILED', 'Not valid', details)),
    ).toEqual({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'Not valid',
      details,
    });
  });

  it('renders a validation failure with the path of each issue', () => {
    const result = loginRequestSchema.safeParse({ email: 'nope' });
    if (result.success) {
      throw new Error('the request should not be valid');
    }

    const body = run(new ZodValidationException(result.error));

    expect(body.statusCode).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.details?.map((detail) => detail.path).sort()).toEqual([
      'email',
      'password',
    ]);
  });

  it.each([
    ['a 401', new UnauthorizedException(), 401, 'UNAUTHENTICATED'],
    ['a 403', new ForbiddenException(), 403, 'FORBIDDEN'],
    ['a 404', new NotFoundException('Cannot GET /api/nope'), 404, 'NOT_FOUND'],
    [
      'a malformed-JSON 400',
      new BadRequestException('Unexpected token } in JSON'),
      400,
      'VALIDATION_FAILED',
    ],
  ])('maps %s to its code', (_name, exception, statusCode, code) => {
    const body = run(exception);

    expect(body.statusCode).toBe(statusCode);
    expect(body.code).toBe(code);
    expect(body.details).toBeUndefined();
    expect(body.message).not.toContain('Cannot GET');
    expect(body.message).not.toContain('JSON');
  });

  it('does not honour a plain HttpException that carries a code', () => {
    const body = run(
      new NotFoundException({ code: 'COURT_INACTIVE', message: 'x' }),
    );

    expect(body.code).toBe('NOT_FOUND');
  });

  it('maps a booking_no_overlap violation to 409 SLOT_TAKEN', () => {
    const body = run(
      prismaError(
        'P2039',
        '23P01',
        'conflicting key value violates exclusion constraint "booking_no_overlap"',
      ),
    );

    expect(body).toMatchObject({ statusCode: 409, code: 'SLOT_TAKEN' });
  });

  it('keeps a CHECK violation a 500', () => {
    const body = run(
      prismaError(
        'P2039',
        '23514',
        'violates check constraint "booking_time_order"',
      ),
    );

    expect(body).toMatchObject({ statusCode: 500, code: 'INTERNAL_ERROR' });
  });

  it.each([
    ['an Error', new Error('secret detail')],
    ['a 413', new PayloadTooLargeException('secret detail')],
    ['a 500 HttpException', new InternalServerErrorException('secret detail')],
    ['a thrown string', 'secret detail'],
  ])('turns %s into a generic 500 and logs it', (_name, exception) => {
    const body = run(exception);

    expect(body).toMatchObject({ statusCode: 500, code: 'INTERNAL_ERROR' });
    expect(JSON.stringify(body)).not.toContain('secret detail');
    expect(logged).toHaveBeenCalledTimes(1);
  });

  it('logs only the name and code of a Prisma error, never its message', () => {
    run(prismaError('P2039', '23514', 'passwordHash: $2b$12$abc'));

    expect(logged).toHaveBeenCalledTimes(1);
    const logLine = JSON.stringify(logged.mock.calls);
    expect(logLine).toContain('PrismaClientKnownRequestError');
    expect(logLine).toContain('P2039');
    expect(logLine).not.toContain('secret query text');
    expect(logLine).not.toContain('passwordHash');
  });

  it('does not log a mapped error', () => {
    run(new ApiException('NOT_FOUND', 'No such court'));
    run(new UnauthorizedException());

    expect(logged).not.toHaveBeenCalled();
  });
});
