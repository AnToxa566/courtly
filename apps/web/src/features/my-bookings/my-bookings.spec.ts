import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Booking, BookingStatus } from '@courtly/contracts';
import { ApiError } from '@/api/client';
import {
  bookingAction,
  cancelFailure,
  describeBooking,
  lockReason,
  NETWORK_MESSAGE,
  STATUS_BADGE,
  tabCount,
} from './my-bookings';

const ID = '5d9f6a52-8d6c-4a0e-9f5a-1f1d3b6a7c10';

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: ID,
    court: { id: ID, name: 'Padel court 1', sportType: 'PADEL' },
    startsAt: '2026-10-10T09:00:00.000Z',
    endsAt: '2026-10-10T11:00:00.000Z',
    date: '2026-10-10',
    startTime: '10:00',
    endTime: '12:00',
    hours: 2,
    totalPriceCents: 4800,
    status: 'upcoming',
    canCancel: true,
    cancellableUntil: '2026-10-10T07:00:00.000Z',
    cancelledAt: null,
    ...overrides,
  };
}

describe('bookingAction', () => {
  it('offers the button when the API says the booking can be cancelled', () => {
    expect(bookingAction({ status: 'upcoming', canCancel: true })).toBe(
      'cancel',
    );
  });

  it('shows the lock for an upcoming booking inside the window', () => {
    expect(bookingAction({ status: 'upcoming', canCancel: false })).toBe(
      'locked',
    );
  });

  it('shows the lock for a booking in progress', () => {
    expect(bookingAction({ status: 'in_progress', canCancel: false })).toBe(
      'locked',
    );
  });

  it('keeps a booking in progress locked even if canCancel were true', () => {
    expect(bookingAction({ status: 'in_progress', canCancel: true })).toBe(
      'locked',
    );
  });

  it('shows nothing for completed and cancelled bookings', () => {
    expect(bookingAction({ status: 'completed', canCancel: false })).toBe(
      'none',
    );
    expect(bookingAction({ status: 'cancelled', canCancel: false })).toBe(
      'none',
    );
  });
});

describe('STATUS_BADGE', () => {
  it('labels every status the API can send', () => {
    const labels = (Object.keys(STATUS_BADGE) as BookingStatus[]).map(
      (status) => STATUS_BADGE[status].label,
    );
    expect(labels).toEqual([
      'Upcoming',
      'In progress',
      'Completed',
      'Cancelled',
    ]);
  });

  it('gives In progress the same green as Upcoming', () => {
    expect(STATUS_BADGE.in_progress.variant).toBe(
      STATUS_BADGE.upcoming.variant,
    );
  });
});

describe('lockReason', () => {
  it('names the facility’s window', () => {
    expect(lockReason(2)).toBe('Cancelling closes 2 hours before start.');
  });

  it('uses the singular for one hour', () => {
    expect(lockReason(1)).toBe('Cancelling closes 1 hour before start.');
  });
});

describe('tabCount', () => {
  it('has no number before the list is loaded', () => {
    expect(tabCount(undefined)).toBeNull();
  });

  it('counts the list, including zero', () => {
    expect(tabCount([])).toBe(0);
    expect(tabCount([booking(), booking()])).toBe(2);
  });
});

describe('cancelFailure', () => {
  it('shows the API message and says the list was refreshed', () => {
    const error = new ApiError(
      422,
      'CANCELLATION_WINDOW_CLOSED',
      'Bookings can only be cancelled up to 2 hours before they start',
    );
    expect(cancelFailure(error)).toEqual({
      title: 'Bookings can only be cancelled up to 2 hours before they start',
      description: 'Your bookings have been refreshed.',
    });
  });

  it('shows nothing for a 401: the client already returned to sign-in', () => {
    const error = new ApiError(401, 'UNAUTHENTICATED', 'Sign in again');
    expect(cancelFailure(error)).toBeNull();
  });

  it('uses the network wording for anything that is not an API error', () => {
    expect(cancelFailure(new TypeError('Failed to fetch'))).toEqual({
      title: NETWORK_MESSAGE,
    });
  });
});

// The browser can be in any zone. The date label is built from the API's
// "YYYY-MM-DD", so it must not move with the browser.
describe.each(['Pacific/Kiritimati', 'Pacific/Pago_Pago'])(
  'describeBooking with the browser in %s',
  (zone) => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('really runs in that zone', () => {
      vi.stubEnv('TZ', zone);
      expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(zone);
    });

    it('repeats court, day, range and price', () => {
      vi.stubEnv('TZ', zone);
      expect(describeBooking(booking(), '2026-10-01')).toEqual({
        courtName: 'Padel court 1',
        details: 'Sat 10 Oct · 10:00–12:00 · €48',
      });
    });

    it('marks the facility’s today', () => {
      vi.stubEnv('TZ', zone);
      expect(describeBooking(booking(), '2026-10-10').details).toBe(
        'Today, Sat 10 Oct · 10:00–12:00 · €48',
      );
    });
  },
);
