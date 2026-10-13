import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import {
  bookingSchema,
  errorResponseSchema,
  type ErrorCode,
} from '@courtly/contracts';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { Clock } from './../src/common/time/clock';
import { PrismaService } from './../src/prisma/prisma.service';
import { FixedClock } from './fixed-clock';

describe('Bookings (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let userId: string;
  let otherUserId: string;
  let token: string;
  let otherToken: string;
  let courtId: string;
  // Lisbon is on UTC+1 until 25 October 2026 and on UTC+0 after it, so in
  // these tests the local time equals UTC from 25 October on.
  const clock = new FixedClock('2026-11-02T10:00:00Z');

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
    clock.set('2026-11-02T10:00:00Z');
    await prisma.$executeRaw`TRUNCATE TABLE "Booking", "Court", "User" CASCADE`;
    const createUser = (email: string) =>
      prisma.user.create({
        data: {
          email,
          passwordHash: 'not used: tokens are signed directly',
          name: email,
        },
      });
    const user = await createUser('maria@courtly.test');
    const other = await createUser('daniel@courtly.test');
    userId = user.id;
    otherUserId = other.id;
    const jwt = app.get(JwtService);
    token = jwt.sign({ sub: user.id });
    otherToken = jwt.sign({ sub: other.id });
    courtId = (await createCourt(480, 1380)).id;
  });

  const createCourt = (
    opensAtMinutes: number,
    closesAtMinutes: number,
    isActive = true,
  ) =>
    prisma.court.create({
      data: {
        name: `Court ${randomUUID()}`,
        sportType: 'PADEL',
        pricePerHourCents: 2000,
        opensAtMinutes,
        closesAtMinutes,
        isActive,
      },
    });

  const post = (body: object, bearer: string | null = token) => {
    const call = request(app.getHttpServer()).post('/api/bookings').send(body);
    return bearer ? call.set('Authorization', `Bearer ${bearer}`) : call;
  };

  const bookCourt = (
    startsAt: string,
    hours: number,
    forCourtId = courtId,
    bearer: string | null = token,
  ) => post({ courtId: forCourtId, startsAt, hours }, bearer);

  const countBookings = () => prisma.booking.count();

  const expectRejected = async (
    call: request.Test,
    status: number,
    code: ErrorCode,
  ) => {
    const before = await countBookings();
    const response = await call.expect(status);
    expect(errorResponseSchema.parse(response.body).code).toBe(code);
    expect(await countBookings()).toBe(before);
  };

  describe('creating a booking', () => {
    it('returns the booking with exactly the contract keys', async () => {
      const response = await bookCourt('2026-11-02T14:00:00.000Z', 1).expect(
        201,
      );

      const body = bookingSchema.parse(response.body);
      expect(Object.keys(response.body as object).sort()).toEqual(
        Object.keys(bookingSchema.shape).sort(),
      );
      expect(Object.keys(body.court).sort()).toEqual([
        'id',
        'name',
        'sportType',
      ]);
      expect(body).toMatchObject({
        court: { id: courtId, sportType: 'PADEL' },
        startsAt: '2026-11-02T14:00:00.000Z',
        endsAt: '2026-11-02T15:00:00.000Z',
        date: '2026-11-02',
        startTime: '14:00',
        endTime: '15:00',
        hours: 1,
        totalPriceCents: 2000,
        status: 'upcoming',
        canCancel: true,
        cancellableUntil: '2026-11-02T12:00:00.000Z',
        cancelledAt: null,
      });
      const row = await prisma.booking.findUniqueOrThrow({
        where: { id: body.id },
      });
      expect(row.userId).toBe(userId);
    });

    it('prices two hours at twice the hourly price', async () => {
      const response = await bookCourt('2026-11-02T14:00:00.000Z', 2).expect(
        201,
      );

      expect(response.body).toMatchObject({
        hours: 2,
        endsAt: '2026-11-02T16:00:00.000Z',
        endTime: '16:00',
        totalPriceCents: 4000,
      });
    });

    it('keeps the price it was booked at when the court price changes', async () => {
      const response = await bookCourt('2026-11-02T14:00:00.000Z', 2).expect(
        201,
      );

      await prisma.court.update({
        where: { id: courtId },
        data: { pricePerHourCents: 9999 },
      });

      const row = await prisma.booking.findUniqueOrThrow({
        where: { id: (response.body as { id: string }).id },
      });
      expect(row.totalPriceCents).toBe(4000);
    });

    it('ignores a userId in the body: the booking belongs to the token', async () => {
      const response = await post({
        courtId,
        startsAt: '2026-11-02T14:00:00.000Z',
        hours: 1,
        userId: otherUserId,
      }).expect(201);

      const row = await prisma.booking.findUniqueOrThrow({
        where: { id: (response.body as { id: string }).id },
      });
      expect(row.userId).toBe(userId);
    });

    it('allows back-to-back bookings', async () => {
      await bookCourt('2026-11-02T14:00:00.000Z', 1).expect(201);
      await bookCourt('2026-11-02T15:00:00.000Z', 1).expect(201);

      expect(await countBookings()).toBe(2);
    });

    it('allows the same slot on another court', async () => {
      const other = await createCourt(480, 1380);
      await bookCourt('2026-11-02T14:00:00.000Z', 1).expect(201);
      await bookCourt('2026-11-02T14:00:00.000Z', 1, other.id).expect(201);
    });

    it('allows the slot again after the booking was cancelled', async () => {
      await prisma.booking.create({
        data: {
          userId: otherUserId,
          courtId,
          startsAt: '2026-11-02T14:00:00.000Z',
          endsAt: '2026-11-02T15:00:00.000Z',
          totalPriceCents: 2000,
          cancelledAt: '2026-11-01T09:00:00.000Z',
        },
      });

      await bookCourt('2026-11-02T14:00:00.000Z', 1).expect(201);
    });
  });

  describe('a slot that is taken', () => {
    it('rejects the same slot with 409 SLOT_TAKEN', async () => {
      await bookCourt('2026-11-02T14:00:00.000Z', 1).expect(201);

      await expectRejected(
        bookCourt('2026-11-02T14:00:00.000Z', 1, courtId, otherToken),
        409,
        'SLOT_TAKEN',
      );
    });

    it('rejects a two-hour booking whose second hour is taken', async () => {
      await bookCourt('2026-11-02T15:00:00.000Z', 1).expect(201);

      await expectRejected(
        bookCourt('2026-11-02T14:00:00.000Z', 2, courtId, otherToken),
        409,
        'SLOT_TAKEN',
      );
    });
  });

  describe('concurrent requests', () => {
    it('ten parallel requests for one slot: one 201, nine 409 SLOT_TAKEN, one row', async () => {
      const responses = await Promise.all(
        Array.from({ length: 10 }, (_, index) =>
          bookCourt(
            '2026-11-03T16:00:00.000Z',
            1,
            courtId,
            index % 2 === 0 ? token : otherToken,
          ),
        ),
      );

      const statuses = responses.map((response) => response.status);
      expect(statuses.filter((status) => status === 201)).toHaveLength(1);
      expect(statuses.filter((status) => status === 409)).toHaveLength(9);
      for (const response of responses.filter((r) => r.status === 409)) {
        expect(errorResponseSchema.parse(response.body).code).toBe(
          'SLOT_TAKEN',
        );
      }
      expect(await prisma.booking.count({ where: { cancelledAt: null } })).toBe(
        1,
      );
    });
  });

  describe('opening hours', () => {
    it('accepts a booking that ends exactly at closing time', async () => {
      await bookCourt('2026-11-03T22:00:00.000Z', 1).expect(201);
    });

    it('accepts a booking that starts exactly at opening time', async () => {
      await bookCourt('2026-11-03T08:00:00.000Z', 1).expect(201);
    });

    it.each([
      ['ends an hour after closing', '2026-11-03T22:00:00.000Z', 2],
      ['starts at closing time', '2026-11-03T23:00:00.000Z', 1],
      ['starts an hour before opening', '2026-11-03T07:00:00.000Z', 1],
    ])('rejects a booking that %s', async (_label, startsAt, hours) => {
      await expectRejected(
        bookCourt(startsAt, hours),
        422,
        'OUTSIDE_OPENING_HOURS',
      );
    });

    it('ends at 00:00 for a booking from 23:00 on a court that closes at 24:00', async () => {
      const allDay = await createCourt(0, 1440);

      const response = await bookCourt(
        '2026-11-02T23:00:00.000Z',
        1,
        allDay.id,
      ).expect(201);

      expect(response.body).toMatchObject({
        date: '2026-11-02',
        startTime: '23:00',
        endTime: '00:00',
        endsAt: '2026-11-03T00:00:00.000Z',
      });
    });
  });

  describe('the start time', () => {
    it('rejects a start exactly now with BOOKING_IN_PAST', async () => {
      await expectRejected(
        bookCourt('2026-11-02T10:00:00.000Z', 1),
        422,
        'BOOKING_IN_PAST',
      );
    });

    it('accepts the hour after now', async () => {
      await bookCourt('2026-11-02T11:00:00.000Z', 1).expect(201);
    });

    it.each([
      ['minutes', '2026-11-02T14:30:00.000Z'],
      ['seconds', '2026-11-02T14:00:30.000Z'],
      ['milliseconds', '2026-11-02T14:00:00.500Z'],
    ])('rejects a start with %s', async (_label, startsAt) => {
      await expectRejected(bookCourt(startsAt, 1), 422, 'NOT_ON_THE_HOUR');
    });
  });

  describe('the order of the rules', () => {
    it('reports NOT_ON_THE_HOUR before BOOKING_IN_PAST', async () => {
      await expectRejected(
        bookCourt('2026-11-01T10:30:00.000Z', 1),
        422,
        'NOT_ON_THE_HOUR',
      );
    });

    it('reports BOOKING_IN_PAST before OUTSIDE_OPENING_HOURS', async () => {
      await expectRejected(
        bookCourt('2026-11-01T05:00:00.000Z', 1),
        422,
        'BOOKING_IN_PAST',
      );
    });

    it('reports COURT_INACTIVE before the time rules', async () => {
      const inactive = await createCourt(480, 1380, false);

      await expectRejected(
        bookCourt('2026-11-01T05:30:00.000Z', 1, inactive.id),
        422,
        'COURT_INACTIVE',
      );
    });

    it('reports NOT_FOUND before the time rules', async () => {
      await expectRejected(
        bookCourt('2026-11-01T05:30:00.000Z', 1, randomUUID()),
        404,
        'NOT_FOUND',
      );
    });
  });

  describe('invalid requests', () => {
    const valid = { startsAt: '2026-11-02T14:00:00.000Z', hours: 1 };

    it.each([
      ['hours 3', { ...valid, hours: 3 }],
      ['hours 0', { ...valid, hours: 0 }],
      ['hours as a string', { ...valid, hours: '1' }],
      ['hours missing', { startsAt: valid.startsAt }],
      [
        'startsAt with an offset',
        { ...valid, startsAt: '2026-11-02T14:00:00+01:00' },
      ],
      [
        'startsAt without a zone',
        { ...valid, startsAt: '2026-11-02T14:00:00' },
      ],
      ['startsAt not a date', { ...valid, startsAt: 'tomorrow' }],
      ['startsAt missing', { hours: 1 }],
      ['courtId not a UUID', { ...valid, courtId: 'not-a-uuid' }],
    ])('rejects %s with 400', async (_label, fields) => {
      await expectRejected(
        post({ courtId, ...fields }),
        400,
        'VALIDATION_FAILED',
      );
    });

    it('rejects a missing courtId with 400', async () => {
      await expectRejected(post(valid), 400, 'VALIDATION_FAILED');
    });
  });

  describe('court and token', () => {
    it('returns 404 for an unknown court', async () => {
      await expectRejected(
        bookCourt('2026-11-02T14:00:00.000Z', 1, randomUUID()),
        404,
        'NOT_FOUND',
      );
    });

    it('returns 422 COURT_INACTIVE for an inactive court', async () => {
      const inactive = await createCourt(480, 1380, false);

      await expectRejected(
        bookCourt('2026-11-02T14:00:00.000Z', 1, inactive.id),
        422,
        'COURT_INACTIVE',
      );
    });

    it('returns 401 without a token', async () => {
      await expectRejected(
        bookCourt('2026-11-02T14:00:00.000Z', 1, courtId, null),
        401,
        'UNAUTHENTICATED',
      );
    });
  });

  describe('when the clocks change', () => {
    beforeEach(() => {
      clock.set('2026-10-20T00:00:00Z');
    });

    it('opens at 08:00 local on both sides of the change', async () => {
      // 24 October is UTC+1, 25 October is UTC+0.
      await bookCourt('2026-10-24T07:00:00.000Z', 1).expect(201);
      await bookCourt('2026-10-25T08:00:00.000Z', 1).expect(201);
    });

    it('rejects an hour before opening on both sides of the change', async () => {
      await expectRejected(
        bookCourt('2026-10-24T06:00:00.000Z', 1),
        422,
        'OUTSIDE_OPENING_HOURS',
      );
      await expectRejected(
        bookCourt('2026-10-25T07:00:00.000Z', 1),
        422,
        'OUTSIDE_OPENING_HOURS',
      );
    });

    it('takes both 01:00 hours of 25 October on a court open all day', async () => {
      const allDay = await createCourt(0, 1440);

      const first = await bookCourt(
        '2026-10-25T00:00:00.000Z',
        1,
        allDay.id,
      ).expect(201);
      const second = await bookCourt(
        '2026-10-25T01:00:00.000Z',
        1,
        allDay.id,
      ).expect(201);

      expect(first.body).toMatchObject({
        date: '2026-10-25',
        startTime: '01:00',
      });
      expect(second.body).toMatchObject({
        date: '2026-10-25',
        startTime: '01:00',
      });
    });

    it('books the first and the last hour of the 25-hour day', async () => {
      const allDay = await createCourt(0, 1440);

      // 00:00 local is 23:00Z on the 24th, and the day ends at 00:00Z.
      const first = await bookCourt(
        '2026-10-24T23:00:00.000Z',
        1,
        allDay.id,
      ).expect(201);
      const last = await bookCourt(
        '2026-10-25T23:00:00.000Z',
        1,
        allDay.id,
      ).expect(201);

      expect(first.body).toMatchObject({
        date: '2026-10-25',
        startTime: '00:00',
      });
      expect(last.body).toMatchObject({
        date: '2026-10-25',
        startTime: '23:00',
        endTime: '00:00',
      });
    });

    it('ends the day an hour early on 28 March 2027, the 23-hour day', async () => {
      const allDay = await createCourt(0, 1440);

      // 22:00Z is 23:00 local (UTC+1): the last hour of the day.
      await bookCourt('2027-03-28T22:00:00.000Z', 1, allDay.id).expect(201);
      await expectRejected(
        bookCourt('2027-03-28T22:00:00.000Z', 2, allDay.id, otherToken),
        422,
        'OUTSIDE_OPENING_HOURS',
      );
    });
  });
});
