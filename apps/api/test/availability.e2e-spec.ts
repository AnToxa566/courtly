import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { availabilitySchema, errorResponseSchema } from '@courtly/contracts';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { Clock } from './../src/common/time/clock';
import { PrismaService } from './../src/prisma/prisma.service';
import { FixedClock } from './fixed-clock';

describe('Availability (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  let courtId: string;
  // Lisbon is on UTC+1 until 25 October 2026 and on UTC+0 after it.
  const clock = new FixedClock('2026-11-01T12:00:00Z');

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(Clock)
      .useValue(clock)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    clock.set('2026-11-01T12:00:00Z');
    await prisma.$executeRaw`TRUNCATE TABLE "Booking", "Court", "User" CASCADE`;
    const user = await prisma.user.create({
      data: {
        email: 'maria@courtly.test',
        passwordHash: 'not used: tokens are signed directly',
        name: 'Maria Kovacs',
      },
    });
    userId = user.id;
    token = app.get(JwtService).sign({ sub: user.id });
    courtId = (await createCourt(480, 1380)).id;
  });

  const createCourt = (opensAtMinutes: number, closesAtMinutes: number) =>
    prisma.court.create({
      data: {
        name: `Court ${randomUUID()}`,
        sportType: 'PADEL',
        pricePerHourCents: 2000,
        opensAtMinutes,
        closesAtMinutes,
      },
    });

  const book = (
    startsAt: string,
    endsAt: string,
    cancelledAt: string | null = null,
  ) =>
    prisma.booking.create({
      data: {
        userId,
        courtId,
        startsAt,
        endsAt,
        totalPriceCents: 2000,
        cancelledAt,
      },
    });

  const availability = (
    id: string,
    query = '',
    bearer: string | null = token,
  ) => {
    const call = request(app.getHttpServer()).get(
      `/api/courts/${id}/availability${query}`,
    );
    return bearer ? call.set('Authorization', `Bearer ${bearer}`) : call;
  };

  const slotsOf = async (id: string, query: string) => {
    const response = await availability(id, query).expect(200);
    return availabilitySchema.parse(response.body);
  };

  const statusAt = (
    slots: { startsAt: string; status: string }[],
    startsAt: string,
  ) => slots.find((slot) => slot.startsAt === startsAt)?.status;

  describe('slots and bookings', () => {
    it('returns 15 hourly slots for a court open 08:00 to 23:00', async () => {
      const body = await slotsOf(courtId, '?date=2026-11-02');

      expect(body).toMatchObject({
        courtId,
        date: '2026-11-02',
        pricePerHourCents: 2000,
      });
      expect(body.slots).toHaveLength(15);
      expect(body.slots[0]).toEqual({
        startsAt: '2026-11-02T08:00:00.000Z',
        endsAt: '2026-11-02T09:00:00.000Z',
        startTime: '08:00',
        status: 'available',
      });
      expect(body.slots[14]).toMatchObject({
        startTime: '22:00',
        endsAt: '2026-11-02T23:00:00.000Z',
      });
    });

    it('marks each hour of a two-hour booking as booked and ignores a cancelled one', async () => {
      await book('2026-11-02T10:00:00.000Z', '2026-11-02T12:00:00.000Z');
      await book(
        '2026-11-02T14:00:00.000Z',
        '2026-11-02T15:00:00.000Z',
        '2026-11-01T09:00:00.000Z',
      );

      const { slots } = await slotsOf(courtId, '?date=2026-11-02');

      expect(statusAt(slots, '2026-11-02T09:00:00.000Z')).toBe('available');
      expect(statusAt(slots, '2026-11-02T10:00:00.000Z')).toBe('booked');
      expect(statusAt(slots, '2026-11-02T11:00:00.000Z')).toBe('booked');
      expect(statusAt(slots, '2026-11-02T12:00:00.000Z')).toBe('available');
      expect(statusAt(slots, '2026-11-02T14:00:00.000Z')).toBe('available');
    });

    it("does not show another court's bookings", async () => {
      const other = await createCourt(480, 1380);
      await prisma.booking.create({
        data: {
          userId,
          courtId: other.id,
          startsAt: '2026-11-02T10:00:00.000Z',
          endsAt: '2026-11-02T11:00:00.000Z',
          totalPriceCents: 2000,
        },
      });

      const { slots } = await slotsOf(courtId, '?date=2026-11-02');

      expect(slots.every((slot) => slot.status === 'available')).toBe(true);
    });
  });

  describe('past slots', () => {
    beforeEach(async () => {
      clock.set('2026-11-02T12:00:00Z');
      await book('2026-11-02T10:00:00.000Z', '2026-11-02T11:00:00.000Z');
      await book('2026-11-02T15:00:00.000Z', '2026-11-02T16:00:00.000Z');
    });

    it('is past up to and including the slot that starts exactly now, even when booked', async () => {
      const { slots } = await slotsOf(courtId, '?date=2026-11-02');

      for (const hour of ['08', '09', '10', '11', '12']) {
        expect(statusAt(slots, `2026-11-02T${hour}:00:00.000Z`)).toBe('past');
      }
      expect(statusAt(slots, '2026-11-02T13:00:00.000Z')).toBe('available');
      expect(statusAt(slots, '2026-11-02T15:00:00.000Z')).toBe('booked');
    });

    it('treats a slot that has begun as past', async () => {
      clock.set('2026-11-02T12:30:00Z');

      const { slots } = await slotsOf(courtId, '?date=2026-11-02');

      expect(statusAt(slots, '2026-11-02T12:00:00.000Z')).toBe('past');
      expect(statusAt(slots, '2026-11-02T13:00:00.000Z')).toBe('available');
    });

    it('makes every slot of an earlier day past', async () => {
      const { slots } = await slotsOf(courtId, '?date=2026-11-01');

      expect(slots.every((slot) => slot.status === 'past')).toBe(true);
    });
  });

  describe('the date', () => {
    it("defaults to the facility's today, not the UTC date", async () => {
      // 23:30 UTC on the 12th is 00:30 on the 13th in Lisbon (UTC+1).
      clock.set('2026-10-12T23:30:00Z');

      const body = await slotsOf(courtId, '');

      expect(body.date).toBe('2026-10-13');
      expect(body.slots[0]?.startsAt).toBe('2026-10-13T07:00:00.000Z');
    });

    it.each([
      ['an impossible date', '?date=2026-02-30'],
      ['a date in the wrong format', '?date=25-10-2026'],
    ])('rejects %s with 400', async (_label, query) => {
      const response = await availability(courtId, query).expect(400);

      expect(errorResponseSchema.parse(response.body).code).toBe(
        'VALIDATION_FAILED',
      );
    });
  });

  describe('errors', () => {
    it('rejects an id that is not a UUID with 400', async () => {
      const response = await availability('not-a-uuid').expect(400);

      expect(errorResponseSchema.parse(response.body).code).toBe(
        'VALIDATION_FAILED',
      );
    });

    it('returns 404 for an unknown court', async () => {
      const response = await availability(randomUUID()).expect(404);

      expect(errorResponseSchema.parse(response.body).code).toBe('NOT_FOUND');
    });

    it('returns 404 for an inactive court', async () => {
      await prisma.court.update({
        where: { id: courtId },
        data: { isActive: false },
      });

      await availability(courtId).expect(404);
    });

    it('returns 401 without a token', async () => {
      const response = await availability(courtId, '', null).expect(401);

      expect(errorResponseSchema.parse(response.body).code).toBe(
        'UNAUTHENTICATED',
      );
    });
  });

  describe('when the clocks change', () => {
    beforeEach(() => {
      clock.set('2026-10-20T00:00:00Z');
    });

    it('opens at 08:00 local on both sides of the change', async () => {
      // 24 October is UTC+1; the clocks go back on 25 October at 02:00.
      const before = await slotsOf(courtId, '?date=2026-10-24');
      const after = await slotsOf(courtId, '?date=2026-10-25');

      expect(before.slots[0]).toMatchObject({
        startsAt: '2026-10-24T07:00:00.000Z',
        startTime: '08:00',
      });
      expect(after.slots[0]).toMatchObject({
        startsAt: '2026-10-25T08:00:00.000Z',
        startTime: '08:00',
      });
      expect(before.slots).toHaveLength(15);
      expect(after.slots).toHaveLength(15);
    });

    it('gives a 00:00 to 24:00 court 25 slots on 25 October, two labelled 01:00', async () => {
      const allDay = await createCourt(0, 1440);
      await prisma.booking.create({
        data: {
          userId,
          courtId: allDay.id,
          startsAt: '2026-10-25T01:00:00.000Z',
          endsAt: '2026-10-25T02:00:00.000Z',
          totalPriceCents: 2000,
        },
      });

      const { slots } = await slotsOf(allDay.id, '?date=2026-10-25');

      expect(slots).toHaveLength(25);
      expect(slots[0]?.startsAt).toBe('2026-10-24T23:00:00.000Z');
      expect(slots[24]?.endsAt).toBe('2026-10-26T00:00:00.000Z');
      const repeated = slots.filter((slot) => slot.startTime === '01:00');
      expect(repeated.map((slot) => slot.startsAt)).toEqual([
        '2026-10-25T00:00:00.000Z',
        '2026-10-25T01:00:00.000Z',
      ]);
      // Only the second 01:00 is the booked hour.
      expect(repeated.map((slot) => slot.status)).toEqual([
        'available',
        'booked',
      ]);
    });

    it('gives a 00:00 to 24:00 court 23 slots on 28 March 2027', async () => {
      const allDay = await createCourt(0, 1440);

      const { slots } = await slotsOf(allDay.id, '?date=2027-03-28');

      expect(slots).toHaveLength(23);
    });
  });
});
