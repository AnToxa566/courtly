import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type Availability,
  type Court,
  type CreateCourtRequest,
  type UpdateCourtRequest,
} from '@courtly/contracts';
import { ApiException } from '../common/errors/api.exception';
import { Clock } from '../common/time/clock';
import {
  facilityToday,
  openingHoursOn,
  timeToMinutes,
} from '../common/time/facility-time';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { toCourt } from './court.mapper';

// Repeats the message of the contract's order check, so a rejected merge looks
// the same to the client as a rejected create. The e2e suite compares the two.
const CLOSES_AFTER_OPENS = 'closesAt must be after opensAt';

@Injectable()
export class CourtsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async listActive(): Promise<Court[]> {
    const rows = await this.prisma.court.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    return rows.map(toCourt);
  }

  // An inactive court is a 404 for users, the same as one that never existed.
  async findActive(id: string): Promise<Court> {
    return toCourt(await this.findActiveRow(id));
  }

  private async findActiveRow(id: string) {
    const row = await this.prisma.court.findFirst({
      where: { id, isActive: true },
    });
    if (!row) {
      throw new ApiException('NOT_FOUND', 'Court not found');
    }
    return row;
  }

  // The day's hourly slots. They are stepped in real hours from the opening
  // instant to the closing instant, so a clock change adds or removes a slot
  // instead of shifting the others. It reads the booking table itself so that
  // courts and bookings never import each other: both need the other's data,
  // so exporting services would create a cycle.
  async getAvailability(id: string, date?: string): Promise<Availability> {
    const court = await this.findActiveRow(id);
    const zone = this.config.get('FACILITY_TIMEZONE', { infer: true });
    const now = this.clock.now();
    const day = date ?? facilityToday(now, zone);
    const { opens, closes } = openingHoursOn(
      day,
      court.opensAtMinutes,
      court.closesAtMinutes,
      zone,
    );

    const bookings = await this.prisma.booking.findMany({
      where: {
        courtId: id,
        cancelledAt: null,
        startsAt: { lt: closes.toJSDate() },
        endsAt: { gt: opens.toJSDate() },
      },
    });

    const slots: Availability['slots'] = [];
    for (
      let start = opens;
      start.toMillis() < closes.toMillis();
      start = start.plus({ hours: 1 })
    ) {
      const end = start.plus({ hours: 1 });
      const isBooked = bookings.some(
        (booking) =>
          booking.startsAt.getTime() < end.toMillis() &&
          booking.endsAt.getTime() > start.toMillis(),
      );
      // A slot that has begun is past even if it is booked.
      let status: Availability['slots'][number]['status'] = 'available';
      if (start.toMillis() <= now.toMillis()) {
        status = 'past';
      } else if (isBooked) {
        status = 'booked';
      }
      slots.push({
        startsAt: start.toJSDate().toISOString(),
        endsAt: end.toJSDate().toISOString(),
        startTime: start.setZone(zone).toFormat('HH:mm'),
        status,
      });
    }

    return {
      courtId: court.id,
      date: day,
      pricePerHourCents: court.pricePerHourCents,
      slots,
    };
  }

  async listAll(): Promise<Court[]> {
    const rows = await this.prisma.court.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
    return rows.map(toCourt);
  }

  async create(input: CreateCourtRequest): Promise<Court> {
    const row = await this.prisma.court.create({
      data: {
        name: input.name,
        sportType: input.sportType,
        pricePerHourCents: input.pricePerHourCents,
        opensAtMinutes: timeToMinutes(input.opensAt),
        closesAtMinutes: timeToMinutes(input.closesAt),
      },
    });
    return toCourt(row);
  }

  async update(id: string, patch: UpdateCourtRequest): Promise<Court> {
    const current = await this.prisma.court.findUnique({ where: { id } });
    if (!current) {
      throw new ApiException('NOT_FOUND', 'Court not found');
    }

    // The contract can compare the two times only when the request carries
    // both. Here the patch is merged with the stored court first.
    const opens =
      patch.opensAt === undefined
        ? current.opensAtMinutes
        : timeToMinutes(patch.opensAt);
    const closes =
      patch.closesAt === undefined
        ? current.closesAtMinutes
        : timeToMinutes(patch.closesAt);
    if (opens >= closes) {
      throw new ApiException('VALIDATION_FAILED', 'The request is not valid', [
        { path: 'closesAt', message: CLOSES_AFTER_OPENS },
      ]);
    }

    const row = await this.prisma.court.update({
      where: { id },
      data: {
        name: patch.name,
        sportType: patch.sportType,
        pricePerHourCents: patch.pricePerHourCents,
        isActive: patch.isActive,
        opensAtMinutes: patch.opensAt === undefined ? undefined : opens,
        closesAtMinutes: patch.closesAt === undefined ? undefined : closes,
      },
    });
    return toCourt(row);
  }
}
