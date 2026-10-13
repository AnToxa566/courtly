import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AdminDay,
  Booking,
  BookingScope,
  CreateBookingRequest,
} from '@courtly/contracts';
import { DateTime } from 'luxon';
import { ApiException } from '../common/errors/api.exception';
import { Clock } from '../common/time/clock';
import {
  facilityDayBounds,
  facilityToday,
  openingHoursOn,
} from '../common/time/facility-time';
import type { Env } from '../config/env';
import { CANCELLATION_WINDOW_HOURS } from '../facility/booking-policy';
import { PrismaService } from '../prisma/prisma.service';
import {
  adminBookingInclude,
  bookingWithCourt,
  toAdminBooking,
  toBooking,
} from './booking.mapper';
import { bookingScope } from './booking-status';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // The rules run in the order recorded in D-079. There is no availability
  // check before the insert: booking_no_overlap is the guarantee, and the
  // exception filter turns its violation into 409 SLOT_TAKEN.
  async create(userId: string, input: CreateBookingRequest): Promise<Booking> {
    const zone = this.config.get('FACILITY_TIMEZONE', { infer: true });
    const now = this.clock.now();

    // Reads the court table itself so that bookings and courts never import
    // each other: both need the other's data, so exporting services would
    // create a cycle. It also tells an inactive court (422) from a missing
    // one (404).
    const court = await this.prisma.court.findUnique({
      where: { id: input.courtId },
    });
    if (!court) {
      throw new ApiException('NOT_FOUND', 'Court not found');
    }
    if (!court.isActive) {
      throw new ApiException('COURT_INACTIVE', 'This court is not available');
    }

    const startsAt = DateTime.fromISO(input.startsAt, { zone: 'utc' });
    const local = startsAt.setZone(zone);
    if (local.minute !== 0 || local.second !== 0 || local.millisecond !== 0) {
      throw new ApiException(
        'NOT_ON_THE_HOUR',
        'A booking must start on a whole hour',
      );
    }
    if (startsAt.toMillis() <= now.toMillis()) {
      throw new ApiException(
        'BOOKING_IN_PAST',
        'The booking starts in the past',
      );
    }

    const endsAt = startsAt.plus({ hours: input.hours });
    const { opens, closes } = openingHoursOn(
      facilityToday(startsAt, zone),
      court.opensAtMinutes,
      court.closesAtMinutes,
      zone,
    );
    if (
      startsAt.toMillis() < opens.toMillis() ||
      endsAt.toMillis() > closes.toMillis()
    ) {
      throw new ApiException(
        'OUTSIDE_OPENING_HOURS',
        'The booking is outside the court opening hours',
      );
    }

    const row = await this.prisma.booking.create({
      data: {
        userId,
        courtId: court.id,
        startsAt: startsAt.toJSDate(),
        endsAt: endsAt.toJSDate(),
        // A snapshot: a later price change must not rewrite this booking.
        totalPriceCents: court.pricePerHourCents * input.hours,
      },
      include: bookingWithCourt,
    });
    return toBooking(row, now, zone);
  }

  // Filters on the derived status instead of a where clause on the dates, so
  // the list boundaries cannot drift from the ones in booking-status.ts
  // (D-077). Unpaginated, as every list is (D-001). Past is newest first and
  // upcoming soonest first, with the court name as tie-break (D-088). No
  // isActive filter: history on a deactivated court stays visible.
  async listMine(userId: string, scope: BookingScope): Promise<Booking[]> {
    const zone = this.config.get('FACILITY_TIMEZONE', { infer: true });
    const now = this.clock.now();
    const rows = await this.prisma.booking.findMany({
      where: { userId },
      include: bookingWithCourt,
      orderBy: [
        { startsAt: scope === 'upcoming' ? 'asc' : 'desc' },
        { court: { name: 'asc' } },
      ],
    });
    return rows
      .map((row) => toBooking(row, now, zone))
      .filter((booking) => bookingScope(booking.status) === scope);
  }

  // The checks run in this order: not yours or missing (404), already
  // cancelled (409), window closed (422). Someone else's booking is
  // indistinguishable from a missing one. A cancelled booking is reported as
  // cancelled even after its window closed. No isActive check: a future
  // booking on a deactivated court can still be cancelled (D-090).
  async cancel(userId: string, id: string): Promise<Booking> {
    const zone = this.config.get('FACILITY_TIMEZONE', { infer: true });
    const now = this.clock.now();
    const found = await this.prisma.booking.findFirst({
      where: { id, userId },
      include: bookingWithCourt,
    });
    if (!found) {
      throw new ApiException('NOT_FOUND', 'Booking not found');
    }
    const booking = toBooking(found, now, zone);
    if (booking.cancelledAt !== null) {
      throw new ApiException('ALREADY_CANCELLED', 'The booking is cancelled');
    }
    if (!booking.canCancel) {
      throw new ApiException(
        'CANCELLATION_WINDOW_CLOSED',
        `Bookings can only be cancelled up to ${CANCELLATION_WINDOW_HOURS} hours before they start`,
      );
    }

    // Conditional on cancelledAt being null, so two cancels that both passed
    // the checks above cannot both succeed and the first cancelledAt stays.
    const { count } = await this.prisma.booking.updateMany({
      where: { id, userId, cancelledAt: null },
      data: { cancelledAt: now.toJSDate() },
    });
    if (count === 0) {
      throw new ApiException('ALREADY_CANCELLED', 'The booking is cancelled');
    }

    const cancelled = await this.prisma.booking.findFirstOrThrow({
      where: { id, userId },
      include: bookingWithCourt,
    });
    return toBooking(cancelled, now, zone);
  }

  // One facility day, whole and unpaginated (D-001). Cancelled bookings and
  // bookings on deactivated courts are listed on purpose, so there is no
  // cancelledAt or isActive filter; only the revenue and booking count leave
  // cancelled ones out (D-005, and the Assumptions section of
  // docs/ARCHITECTURE.md). The order is D-096. A booking belongs to the day
  // it starts on, even when it ends after midnight.
  async listDay(date?: string): Promise<AdminDay> {
    const zone = this.config.get('FACILITY_TIMEZONE', { infer: true });
    const now = this.clock.now();
    const day = date ?? facilityToday(now, zone);
    const { start, end } = facilityDayBounds(day, zone);

    const rows = await this.prisma.booking.findMany({
      where: { startsAt: { gte: start.toJSDate(), lt: end.toJSDate() } },
      include: adminBookingInclude,
      orderBy: [{ startsAt: 'asc' }, { court: { name: 'asc' } }, { id: 'asc' }],
    });
    const bookings = rows.map((row) => toAdminBooking(row, now, zone));

    const cancelled = bookings.filter((b) => b.status === 'cancelled');
    const active = bookings.filter((b) => b.status !== 'cancelled');
    const sum = (list: typeof bookings) =>
      list.reduce((total, b) => total + b.totalPriceCents, 0);

    return {
      date: day,
      totalRevenueCents: sum(active),
      bookingCount: active.length,
      cancelledCount: cancelled.length,
      cancelledCents: sum(cancelled),
      bookings,
    };
  }
}
