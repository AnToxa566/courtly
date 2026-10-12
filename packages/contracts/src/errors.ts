import { z } from 'zod';

export const errorCodeSchema = z.enum([
  'VALIDATION_FAILED',
  'INVALID_CREDENTIALS',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'SLOT_TAKEN',
  'ALREADY_CANCELLED',
  'BOOKING_IN_PAST',
  'OUTSIDE_OPENING_HOURS',
  'NOT_ON_THE_HOUR',
  'COURT_INACTIVE',
  'CANCELLATION_WINDOW_CLOSED',
  'INTERNAL_ERROR',
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const errorResponseSchema = z.object({
  statusCode: z.int(),
  code: errorCodeSchema,
  message: z.string(),
  details: z
    .array(z.object({ path: z.string(), message: z.string() }))
    .optional(),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
