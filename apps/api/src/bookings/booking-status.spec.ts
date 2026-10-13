import {
  bookingStatusSchema,
  type BookingScope,
  type BookingStatus,
} from '@courtly/contracts';
import { DateTime } from 'luxon';
import { bookingScope, bookingStatus } from './booking-status';

const at = (iso: string) => DateTime.fromISO(iso, { zone: 'utc' });
const STARTS = at('2026-11-03T16:00:00Z');
const ENDS = at('2026-11-03T17:00:00Z');
const active = { startsAt: STARTS, endsAt: ENDS, cancelledAt: null };
const cancelled = { ...active, cancelledAt: at('2026-11-01T09:00:00Z') };

const MS = 1;
const TWO_HOURS = 2 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const relativeTo = (base: DateTime, offsetMs: number) =>
  DateTime.fromMillis(base.toMillis() + offsetMs, { zone: 'utc' });

describe('bookingStatus', () => {
  it.each([
    ['start - 2h - 1ms', relativeTo(STARTS, -TWO_HOURS - MS), 'upcoming', true],
    ['start - 2h exactly', relativeTo(STARTS, -TWO_HOURS), 'upcoming', true],
    [
      'start - 2h + 1ms',
      relativeTo(STARTS, -TWO_HOURS + MS),
      'upcoming',
      false,
    ],
    ['start - 1ms', relativeTo(STARTS, -MS), 'upcoming', false],
    ['start exactly', STARTS, 'in_progress', false],
    ['end - 1ms', relativeTo(ENDS, -MS), 'in_progress', false],
    ['end exactly', ENDS, 'completed', false],
    ['a day after the end', relativeTo(ENDS, 24 * HOUR), 'completed', false],
  ])('at %s: status %s, canCancel %s', (_label, now, status, canCancel) => {
    const result = bookingStatus(active, now);
    expect(result.status).toBe(status);
    expect(result.canCancel).toBe(canCancel);
  });

  it.each([
    ['before the start', relativeTo(STARTS, -3 * HOUR)],
    ['while it would be in progress', relativeTo(STARTS, HOUR / 2)],
    ['after the end', relativeTo(ENDS, HOUR)],
  ])('a cancelled booking is cancelled and not cancellable %s', (_l, now) => {
    const result = bookingStatus(cancelled, now);
    expect(result.status).toBe('cancelled');
    expect(result.canCancel).toBe(false);
  });

  it('cancellableUntil is always two hours before the start', () => {
    for (const now of [
      relativeTo(STARTS, -24 * HOUR),
      STARTS,
      relativeTo(ENDS, HOUR),
    ]) {
      for (const booking of [active, cancelled]) {
        expect(bookingStatus(booking, now).cancellableUntil.toMillis()).toBe(
          STARTS.toMillis() - TWO_HOURS,
        );
      }
    }
  });

  it('produces exactly the statuses the contract lists', () => {
    const produced = new Set([
      bookingStatus(active, relativeTo(STARTS, -HOUR)).status,
      bookingStatus(active, STARTS).status,
      bookingStatus(active, ENDS).status,
      bookingStatus(cancelled, STARTS).status,
    ]);
    expect([...produced].sort()).toEqual(
      [...bookingStatusSchema.options].sort(),
    );
  });
});

describe('bookingScope', () => {
  // A Record, so adding a status to the contract fails to compile here.
  const expectedScope: Record<BookingStatus, BookingScope> = {
    upcoming: 'upcoming',
    in_progress: 'upcoming',
    completed: 'past',
    cancelled: 'past',
  };

  it.each(bookingStatusSchema.options)(
    'puts %s in the right list',
    (status) => {
      expect(bookingScope(status)).toBe(expectedScope[status]);
    },
  );

  it('moves a booking from the upcoming list to the past list at exactly its end', () => {
    const scopeAt = (now: DateTime) =>
      bookingScope(bookingStatus(active, now).status);

    expect(scopeAt(relativeTo(STARTS, -MS))).toBe('upcoming');
    expect(scopeAt(STARTS)).toBe('upcoming');
    expect(scopeAt(relativeTo(ENDS, -MS))).toBe('upcoming');
    expect(scopeAt(ENDS)).toBe('past');
  });

  it('keeps a cancelled booking in the past list before its start', () => {
    const { status } = bookingStatus(cancelled, relativeTo(STARTS, -3 * HOUR));

    expect(bookingScope(status)).toBe('past');
  });
});
