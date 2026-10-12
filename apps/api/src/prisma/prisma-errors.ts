import { Prisma } from '../generated/prisma/client';

const BOOKING_NO_OVERLAP = 'booking_no_overlap';

// @prisma/adapter-pg has no mapping for SQLSTATE 23P01, so an exclusion
// violation arrives as P2039 with the original PostgreSQL error nested under
// meta.driverAdapterError.cause. The adapter drops pg's `constraint` field, so
// the constraint name is only available inside the message text. CHECK
// violations (23514) also arrive as P2039, which is why the code alone is not
// enough: the constraint name must match too.
export function isBookingOverlapError(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2039'
  ) {
    return false;
  }
  const adapterError = error.meta?.driverAdapterError;
  if (
    typeof adapterError !== 'object' ||
    adapterError === null ||
    !('cause' in adapterError)
  ) {
    return false;
  }
  const cause = adapterError.cause;
  return (
    typeof cause === 'object' &&
    cause !== null &&
    'originalCode' in cause &&
    cause.originalCode === '23P01' &&
    'originalMessage' in cause &&
    typeof cause.originalMessage === 'string' &&
    cause.originalMessage.includes(`"${BOOKING_NO_OVERLAP}"`)
  );
}
