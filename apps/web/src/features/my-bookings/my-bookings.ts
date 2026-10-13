import type { Booking, BookingStatus } from '@courtly/contracts';
import { ApiError } from '@/api/client';
import { formatDayLabel, formatHours, formatPrice } from '@/lib/format';

export const LOCK_TITLE = 'Can’t cancel anymore';
export const NETWORK_MESSAGE = 'We couldn’t reach the server. Try again.';

// What a row offers. The status decides first: a booking in progress is
// always locked, and a completed or cancelled one never offers anything.
// For an upcoming booking the API's `canCancel` decides (the web app has no
// clock), so the button is never shown on the web app's own guess.
export function bookingAction(
  booking: Pick<Booking, 'status' | 'canCancel'>,
): 'cancel' | 'locked' | 'none' {
  if (booking.status === 'completed' || booking.status === 'cancelled') {
    return 'none';
  }
  if (booking.status === 'in_progress') return 'locked';
  return booking.canCancel ? 'cancel' : 'locked';
}

// Typed as a Record so a new status from the API fails the build here
// instead of rendering without a badge. The variants are the Badge's own
// (DESIGN.md section 4). In progress shares Upcoming's green (D-093).
export const STATUS_BADGE: Record<
  BookingStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' }
> = {
  upcoming: { label: 'Upcoming', variant: 'default' },
  in_progress: { label: 'In progress', variant: 'default' },
  completed: { label: 'Completed', variant: 'secondary' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
};

// The second line under the lock (D-092). The number is the facility's, not
// a copy of the rule.
export function lockReason(cancellationWindowHours: number): string {
  return `Cancelling closes ${formatHours(cancellationWindowHours)} before start.`;
}

// The two lines the cancel dialog repeats back to the player (DESIGN.md 4C).
export function describeBooking(
  booking: Booking,
  today: string,
): { courtName: string; details: string } {
  return {
    courtName: booking.court.name,
    details: `${formatDayLabel(booking.date, today)} · ${booking.startTime}–${booking.endTime} · ${formatPrice(booking.totalPriceCents)}`,
  };
}

// No number until the list has loaded: a tab that is still loading, or that
// failed, must not claim "0".
export function tabCount(
  bookings: readonly Booking[] | undefined,
): number | null {
  return bookings ? bookings.length : null;
}

// What the cancel dialog shows after a failed request (D-094, D-089). Null
// for a 401: the API client has already sent the user back to sign-in.
export function cancelFailure(
  error: unknown,
): { title: string; description?: string } | null {
  if (error instanceof ApiError) {
    if (error.status === 401) return null;
    return {
      title: error.message,
      description: 'Your bookings have been refreshed.',
    };
  }
  return { title: NETWORK_MESSAGE };
}
