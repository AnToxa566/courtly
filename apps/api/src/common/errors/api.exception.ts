import { HttpException } from '@nestjs/common';
import type { ErrorCode, ErrorResponse } from '@courtly/contracts';

// Typed as Record<ErrorCode, number> so adding a code to the contract fails
// the build here until it is given a status. Statuses are the table in
// ARCHITECTURE.md, "API".
export const ERROR_STATUS: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 400,
  INVALID_CREDENTIALS: 401,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SLOT_TAKEN: 409,
  ALREADY_CANCELLED: 409,
  BOOKING_IN_PAST: 422,
  OUTSIDE_OPENING_HOURS: 422,
  NOT_ON_THE_HOUR: 422,
  COURT_INACTIVE: 422,
  CANCELLATION_WINDOW_CLOSED: 422,
  INTERNAL_ERROR: 500,
};

// The only way services and guards raise a domain error. The filter turns the
// { code, message } body into the error envelope. `details` is for validation
// that needs stored data, so the contract cannot run it.
export class ApiException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: ErrorResponse['details'],
  ) {
    super({ code, message }, ERROR_STATUS[code]);
  }
}
