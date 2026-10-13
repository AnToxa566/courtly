import type { BookingStatus } from '@courtly/contracts';
import type { DateTime } from 'luxon';
import { CANCELLATION_WINDOW_HOURS } from '../facility/booking-policy';

type BookingTimes = {
  startsAt: DateTime;
  endsAt: DateTime;
  cancelledAt: DateTime | null;
};

// Status is derived from time when read, never stored. "Now" is an argument so
// this stays pure and testable. Boundaries are half-open: at exactly startsAt
// a booking is in progress, at exactly endsAt it is completed.
export function bookingStatus(
  booking: BookingTimes,
  now: DateTime,
): { status: BookingStatus; canCancel: boolean; cancellableUntil: DateTime } {
  const cancellableUntil = booking.startsAt.minus({
    hours: CANCELLATION_WINDOW_HOURS,
  });
  const nowMs = now.toMillis();

  let status: BookingStatus;
  if (booking.cancelledAt !== null) {
    status = 'cancelled';
  } else if (nowMs < booking.startsAt.toMillis()) {
    status = 'upcoming';
  } else if (nowMs < booking.endsAt.toMillis()) {
    status = 'in_progress';
  } else {
    status = 'completed';
  }

  // Exactly two hours before the start is still cancellable.
  const canCancel =
    booking.cancelledAt === null && nowMs <= cancellableUntil.toMillis();
  return { status, canCancel, cancellableUntil };
}
