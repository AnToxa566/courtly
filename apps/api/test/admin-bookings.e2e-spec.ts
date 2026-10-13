import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import {
  adminDaySchema,
  errorResponseSchema,
  type AdminDay,
} from '@courtly/contracts';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { Clock } from './../src/common/time/clock';
import { PrismaService } from './../src/prisma/prisma.service';
import { FixedClock } from './fixed-clock';

describe('Admin bookings (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;
  let maria: { id: string; token: string };
  let daniel: { id: string; token: string };
  let admin: { id: string; token: string };
  let courtA: string;
  let courtB: string;
  let courtS: string;
  // Lisbon is on UTC+0 from 25 October 2026 and UTC+1 before it.
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
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    clock.set('2026-11-02T10:00:00Z');
    await prisma.$executeRaw`TRUNCATE TABLE "Booking", "Court", "User" CASCADE`;
    const createUser = async (
      email: string,
      name: string,
      role: 'USER' | 'ADMIN',
    ) => {
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash: 'not used: tokens are signed directly',
          name,
          role,
        },
      });
      return { id: user.id, token: jwt.sign({ sub: user.id }) };
    };
    maria = await createUser('maria@courtly.test', 'Maria', 'USER');
    daniel = await createUser('daniel@courtly.test', 'Daniel', 'USER');
    admin = await createUser('admin@courtly.test', 'Admin', 'ADMIN');
    // Court B is created first, so creation order is the reverse of name order.
    courtB = (await createCourt('Court B', true)).id;
    courtA = (await createCourt('Court A', true)).id;
    courtS = (await createCourt('Court S', false)).id;
  });

  // Open all day, so bookings around midnight are realistic.
  const createCourt = (name: string, isActive: boolean) =>
    prisma.court.create({
      data: {
        name,
        sportType: 'PADEL',
        pricePerHourCents: 2000,
        opensAtMinutes: 0,
        closesAtMinutes: 1440,
        isActive,
      },
    });

  const createBooking = async (
    userId: string,
    courtId: string,
    startsAt: string,
    endsAt: string,
    options: { cancelledAt?: string; priceCents?: number } = {},
  ) =>
    (
      await prisma.booking.create({
        data: {
          userId,
          courtId,
          startsAt,
          endsAt,
          totalPriceCents: options.priceCents ?? 2000,
          cancelledAt: options.cancelledAt ?? null,
        },
      })
    ).id;

  const get = (path: string, bearer: string | null) => {
    const call = request(app.getHttpServer()).get(path);
    return bearer ? call.set('Authorization', `Bearer ${bearer}`) : call;
  };

  const day = async (query = ''): Promise<AdminDay> => {
    const response = await get(
      `/api/admin/bookings${query}`,
      admin.token,
    ).expect(200);
    return adminDaySchema.parse(response.body);
  };

  const idsOf = (result: AdminDay) => result.bookings.map((b) => b.id);

  describe('access', () => {
    it('returns 401 without a token', async () => {
      const response = await get('/api/admin/bookings', null).expect(401);

      expect(errorResponseSchema.parse(response.body).code).toBe(
        'UNAUTHENTICATED',
      );
    });

    it('returns 403 for a user', async () => {
      const response = await get('/api/admin/bookings', maria.token).expect(
        403,
      );

      expect(errorResponseSchema.parse(response.body).code).toBe('FORBIDDEN');
    });

    it('returns 200 for an admin', async () => {
      await day();
    });

    it('returns 403 for an admin demoted after the token was issued', async () => {
      await prisma.user.update({
        where: { id: admin.id },
        data: { role: 'USER' },
      });

      const response = await get('/api/admin/bookings', admin.token).expect(
        403,
      );

      expect(errorResponseSchema.parse(response.body).code).toBe('FORBIDDEN');
    });
  });

  describe('listing', () => {
    it('orders by start, then court name, then id, with the player on each row', async () => {
      const early = await createBooking(
        daniel.id,
        courtB,
        '2026-11-03T09:00:00Z',
        '2026-11-03T10:00:00Z',
      );
      const aCancelled = await createBooking(
        daniel.id,
        courtA,
        '2026-11-03T10:00:00Z',
        '2026-11-03T11:00:00Z',
        { cancelledAt: '2026-11-01T09:00:00Z' },
      );
      const aActive = await createBooking(
        maria.id,
        courtA,
        '2026-11-03T10:00:00Z',
        '2026-11-03T11:00:00Z',
      );
      const bSameStart = await createBooking(
        maria.id,
        courtB,
        '2026-11-03T10:00:00Z',
        '2026-11-03T11:00:00Z',
      );

      const result = await day('?date=2026-11-03');

      expect(idsOf(result)).toEqual([
        early,
        ...[aCancelled, aActive].sort(),
        bSameStart,
      ]);
      const byId = new Map(result.bookings.map((b) => [b.id, b.user]));
      expect(byId.get(early)).toMatchObject({
        name: 'Daniel',
        email: 'daniel@courtly.test',
      });
      expect(byId.get(aActive)).toMatchObject({
        name: 'Maria',
        email: 'maria@courtly.test',
      });
    });

    it('counts only active bookings in the revenue and reports the cancelled ones apart', async () => {
      await createBooking(
        maria.id,
        courtA,
        '2026-11-03T09:00:00Z',
        '2026-11-03T10:00:00Z',
        { priceCents: 2800 },
      );
      await createBooking(
        daniel.id,
        courtB,
        '2026-11-03T10:00:00Z',
        '2026-11-03T12:00:00Z',
        { priceCents: 6400 },
      );
      const cancelled = await createBooking(
        maria.id,
        courtA,
        '2026-11-03T11:00:00Z',
        '2026-11-03T12:00:00Z',
        { priceCents: 2800, cancelledAt: '2026-11-01T09:00:00Z' },
      );

      const result = await day('?date=2026-11-03');

      expect(result).toMatchObject({
        date: '2026-11-03',
        totalRevenueCents: 9200,
        bookingCount: 2,
        cancelledCount: 1,
        cancelledCents: 2800,
      });
      expect(result.bookings).toHaveLength(3);
      expect(result.bookings.find((b) => b.id === cancelled)?.status).toBe(
        'cancelled',
      );
    });

    it('lists a booking on an inactive court and counts it in the revenue', async () => {
      const id = await createBooking(
        maria.id,
        courtS,
        '2026-11-03T09:00:00Z',
        '2026-11-03T10:00:00Z',
      );

      const result = await day('?date=2026-11-03');

      expect(idsOf(result)).toEqual([id]);
      expect(result.bookings[0].court.name).toBe('Court S');
      expect(result.totalRevenueCents).toBe(2000);
      expect(result.bookingCount).toBe(1);
    });

    it('returns an empty day with zero totals and echoes the date', async () => {
      const result = await day('?date=2026-11-03');

      expect(result).toEqual({
        date: '2026-11-03',
        totalRevenueCents: 0,
        bookingCount: 0,
        cancelledCount: 0,
        cancelledCents: 0,
        bookings: [],
      });
    });

    it('lists a day with only cancelled bookings and zero revenue', async () => {
      await createBooking(
        maria.id,
        courtA,
        '2026-11-03T09:00:00Z',
        '2026-11-03T10:00:00Z',
        { cancelledAt: '2026-11-01T09:00:00Z' },
      );

      const result = await day('?date=2026-11-03');

      expect(result).toMatchObject({
        totalRevenueCents: 0,
        bookingCount: 0,
        cancelledCount: 1,
        cancelledCents: 2000,
      });
      expect(result.bookings).toHaveLength(1);
    });

    it('rejects a malformed date with 400 VALIDATION_FAILED', async () => {
      for (const date of ['2026-13-45', 'abc', '2026-02-30']) {
        const response = await get(
          `/api/admin/bookings?date=${date}`,
          admin.token,
        ).expect(400);

        expect(errorResponseSchema.parse(response.body).code).toBe(
          'VALIDATION_FAILED',
        );
      }
    });
  });

  describe('the facility day', () => {
    it('puts a booking on the day it starts, in the facility zone', async () => {
      // 12 October 2026 is UTC+1.
      const lateOnD = await createBooking(
        maria.id,
        courtA,
        '2026-10-12T22:00:00Z',
        '2026-10-12T23:00:00Z',
      );
      // Midnight in Lisbon, but still the 12th in UTC.
      const midnightOnNext = await createBooking(
        maria.id,
        courtA,
        '2026-10-12T23:00:00Z',
        '2026-10-13T00:00:00Z',
      );
      // 23:00 to 01:00 local: it belongs to the day it starts on.
      const crossesMidnight = await createBooking(
        daniel.id,
        courtB,
        '2026-10-12T22:00:00Z',
        '2026-10-13T00:00:00Z',
      );

      const d = await day('?date=2026-10-12');
      const next = await day('?date=2026-10-13');

      expect(idsOf(d).sort()).toEqual([lateOnD, crossesMidnight].sort());
      expect(idsOf(next)).toEqual([midnightOnNext]);
    });

    it('is 25 hours long when the clocks go back (25 October 2026)', async () => {
      const midnight = await createBooking(
        maria.id,
        courtA,
        '2026-10-24T23:00:00Z',
        '2026-10-25T00:00:00Z',
      );
      const firstOne = await createBooking(
        maria.id,
        courtB,
        '2026-10-25T00:00:00Z',
        '2026-10-25T01:00:00Z',
      );
      const secondOne = await createBooking(
        maria.id,
        courtA,
        '2026-10-25T01:00:00Z',
        '2026-10-25T02:00:00Z',
      );
      const last = await createBooking(
        maria.id,
        courtB,
        '2026-10-25T23:00:00Z',
        '2026-10-26T00:00:00Z',
      );
      const nextDay = await createBooking(
        maria.id,
        courtA,
        '2026-10-26T00:00:00Z',
        '2026-10-26T01:00:00Z',
      );

      const result = await day('?date=2026-10-25');

      expect(idsOf(result)).toEqual([midnight, firstOne, secondOne, last]);
      expect(idsOf(result)).not.toContain(nextDay);
    });

    it('is 23 hours long when the clocks go forward (28 March 2027)', async () => {
      const lastHour = await createBooking(
        maria.id,
        courtA,
        '2027-03-28T22:00:00Z',
        '2027-03-28T23:00:00Z',
      );
      const nextDay = await createBooking(
        maria.id,
        courtB,
        '2027-03-28T23:00:00Z',
        '2027-03-29T00:00:00Z',
      );

      const result = await day('?date=2027-03-28');

      expect(idsOf(result)).toEqual([lastHour]);
      expect(idsOf(result)).not.toContain(nextDay);
    });

    it('defaults to the facility date, not the UTC date', async () => {
      // 23:30Z on 12 October is 00:30 on 13 October in Lisbon (UTC+1).
      clock.set('2026-10-12T23:30:00Z');
      // Midnight in Lisbon: the 13th there, though still the 12th in UTC.
      const justAfterMidnight = await createBooking(
        daniel.id,
        courtB,
        '2026-10-12T23:00:00Z',
        '2026-10-13T00:00:00Z',
      );
      const today = await createBooking(
        maria.id,
        courtA,
        '2026-10-13T08:00:00Z',
        '2026-10-13T09:00:00Z',
      );
      const yesterday = await createBooking(
        maria.id,
        courtA,
        '2026-10-12T21:00:00Z',
        '2026-10-12T22:00:00Z',
      );

      const result = await day();

      expect(result.date).toBe('2026-10-13');
      expect(idsOf(result)).toEqual([justAfterMidnight, today]);
      expect(idsOf(result)).not.toContain(yesterday);
    });
  });

  describe('response shape', () => {
    it('carries only id, name and email for each user and no password', async () => {
      await createBooking(
        maria.id,
        courtA,
        '2026-11-03T09:00:00Z',
        '2026-11-03T10:00:00Z',
      );
      await createBooking(
        daniel.id,
        courtB,
        '2026-11-03T09:00:00Z',
        '2026-11-03T10:00:00Z',
      );

      const response = await get(
        '/api/admin/bookings?date=2026-11-03',
        admin.token,
      ).expect(200);

      const body = response.body as { bookings: { user: object }[] };
      expect(body.bookings).toHaveLength(2);
      for (const booking of body.bookings) {
        expect(Object.keys(booking.user).sort()).toEqual([
          'email',
          'id',
          'name',
        ]);
      }
      expect(JSON.stringify(response.body)).not.toMatch(/password/i);
    });
  });

  describe('status', () => {
    it('takes the status from the clock at each boundary', async () => {
      const started = await createBooking(
        maria.id,
        courtA,
        '2026-11-02T10:00:00Z',
        '2026-11-02T11:00:00Z',
      );
      const ended = await createBooking(
        maria.id,
        courtA,
        '2026-11-02T09:00:00Z',
        '2026-11-02T10:00:00Z',
      );
      const later = await createBooking(
        maria.id,
        courtA,
        '2026-11-02T12:00:00Z',
        '2026-11-02T13:00:00Z',
      );
      const cancelled = await createBooking(
        daniel.id,
        courtB,
        '2026-11-02T10:00:00Z',
        '2026-11-02T11:00:00Z',
        { cancelledAt: '2026-11-01T09:00:00Z' },
      );

      const result = await day('?date=2026-11-02');
      const statusOf = (id: string) =>
        result.bookings.find((b) => b.id === id)?.status;

      expect(statusOf(started)).toBe('in_progress');
      expect(statusOf(ended)).toBe('completed');
      expect(statusOf(later)).toBe('upcoming');
      expect(statusOf(cancelled)).toBe('cancelled');
    });

    it('allows cancelling at exactly two hours before the start', async () => {
      const id = await createBooking(
        maria.id,
        courtA,
        '2026-11-02T10:00:00Z',
        '2026-11-02T11:00:00Z',
      );
      clock.set('2026-11-02T08:00:00Z');

      const result = await day('?date=2026-11-02');

      expect(result.bookings.find((b) => b.id === id)?.canCancel).toBe(true);
    });
  });
});
