import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Booking, CreateBookingRequest } from '@courtly/contracts';
import { DateTime } from 'luxon';
import { ApiException } from '../common/errors/api.exception';
import { Clock } from '../common/time/clock';
import { facilityToday, openingHoursOn } from '../common/time/facility-time';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { bookingWithCourt, toBooking } from './booking.mapper';

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
}
