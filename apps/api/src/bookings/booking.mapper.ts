import type { Booking } from '@courtly/contracts';
import { DateTime } from 'luxon';
import { facilityToday } from '../common/time/facility-time';
import type { Prisma } from '../generated/prisma/client';
import { bookingStatus } from './booking-status';

// The court fields a booking response carries, and nothing else.
export const bookingWithCourt = {
  court: { select: { id: true, name: true, sportType: true } },
} satisfies Prisma.BookingInclude;

export type BookingRow = Prisma.BookingGetPayload<{
  include: typeof bookingWithCourt;
}>;

// Builds the contract's keys one by one instead of spreading the row, so a
// column added to the table later does not reach the response by accident.
export function toBooking(
  row: BookingRow,
  now: DateTime,
  zone: string,
): Booking {
  const startsAt = DateTime.fromJSDate(row.startsAt, { zone: 'utc' });
  const endsAt = DateTime.fromJSDate(row.endsAt, { zone: 'utc' });
  const cancelledAt =
    row.cancelledAt === null
      ? null
      : DateTime.fromJSDate(row.cancelledAt, { zone: 'utc' });
  const { status, canCancel, cancellableUntil } = bookingStatus(
    { startsAt, endsAt, cancelledAt },
    now,
  );

  return {
    id: row.id,
    court: {
      id: row.court.id,
      name: row.court.name,
      sportType: row.court.sportType,
    },
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    date: facilityToday(startsAt, zone),
    startTime: startsAt.setZone(zone).toFormat('HH:mm'),
    // A booking that ends at midnight has endTime "00:00".
    endTime: endsAt.setZone(zone).toFormat('HH:mm'),
    hours: (row.endsAt.getTime() - row.startsAt.getTime()) / 3_600_000,
    totalPriceCents: row.totalPriceCents,
    status,
    canCancel,
    cancellableUntil: cancellableUntil.toJSDate().toISOString(),
    cancelledAt:
      row.cancelledAt === null ? null : row.cancelledAt.toISOString(),
  };
}
