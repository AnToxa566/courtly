import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import {
  bookingSchema,
  errorResponseSchema,
  type Booking,
} from '@courtly/contracts';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { Clock } from './../src/common/time/clock';
import { PrismaService } from './../src/prisma/prisma.service';
import { FixedClock } from './fixed-clock';

describe('My bookings (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;
  let maria: { id: string; token: string };
  let daniel: { id: string; token: string };
  let admin: { id: string; token: string };
  let courtA: string;
  let courtB: string;
  let courtS: string;
  // Lisbon is on UTC+0 from 25 October 2026, so local time equals UTC here.
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
    const createUser = async (email: string, role: 'USER' | 'ADMIN') => {
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash: 'not used: tokens are signed directly',
          name: email,
          role,
        },
      });
      return { id: user.id, token: jwt.sign({ sub: user.id }) };
    };
    maria = await createUser('maria@courtly.test', 'USER');
    daniel = await createUser('daniel@courtly.test', 'USER');
    admin = await createUser('admin@courtly.test', 'ADMIN');
    courtA = (await createCourt('Court A', true)).id;
    courtB = (await createCourt('Court B', true)).id;
    courtS = (await createCourt('Court S', false)).id;
  });

  const createCourt = (name: string, isActive: boolean) =>
    prisma.court.create({
      data: {
        name,
        sportType: 'PADEL',
        pricePerHourCents: 2000,
        opensAtMinutes: 480,
        closesAtMinutes: 1380,
        isActive,
      },
    });

  // One hour at 2000 cents, unless a test needs something else.
  const createBooking = async (
    userId: string,
    courtId: string,
    startsAt: string,
    endsAt: string,
    cancelledAt: string | null = null,
  ) =>
    (
      await prisma.booking.create({
        data: {
          userId,
          courtId,
          startsAt,
          endsAt,
          totalPriceCents: 2000,
          cancelledAt,
        },
      })
    ).id;

  const get = (path: string, bearer: string | null) => {
    const call = request(app.getHttpServer()).get(path);
    return bearer ? call.set('Authorization', `Bearer ${bearer}`) : call;
  };

  const listMine = async (bearer: string, query = ''): Promise<Booking[]> => {
    const response = await get(`/api/bookings/mine${query}`, bearer).expect(
      200,
    );
    return (response.body as unknown[]).map((item) =>
      bookingSchema.parse(item),
    );
  };

  describe('listing', () => {
    // Maria's seven bookings cover every boundary of the status rules at the
    // clock's 2026-11-02T10:00Z; Daniel's three share courts and dates with
    // hers, so a missing owner filter shows up in the lists.
    let ids: Record<string, string>;

    beforeEach(async () => {
      ids = {
        mStartsNow: await createBooking(
          maria.id,
          courtA,
          '2026-11-02T10:00:00Z',
          '2026-11-02T11:00:00Z',
        ),
        mTomorrow: await createBooking(
          maria.id,
          courtA,
          '2026-11-03T14:00:00Z',
          '2026-11-03T15:00:00Z',
        ),
        mLater: await createBooking(
          maria.id,
          courtA,
          '2026-11-10T09:00:00Z',
          '2026-11-10T10:00:00Z',
        ),
        mCancelled: await createBooking(
          maria.id,
          courtB,
          '2026-11-05T12:00:00Z',
          '2026-11-05T13:00:00Z',
          '2026-11-01T09:00:00Z',
        ),
        mEndsNow: await createBooking(
          maria.id,
          courtB,
          '2026-11-02T09:00:00Z',
          '2026-11-02T10:00:00Z',
        ),
        mYesterday: await createBooking(
          maria.id,
          courtA,
          '2026-11-01T14:00:00Z',
          '2026-11-01T15:00:00Z',
        ),
        mInactive: await createBooking(
          maria.id,
          courtS,
          '2026-10-20T10:00:00Z',
          '2026-10-20T11:00:00Z',
        ),
        dTomorrow: await createBooking(
          daniel.id,
          courtA,
          '2026-11-03T15:00:00Z',
          '2026-11-03T16:00:00Z',
        ),
        dYesterday: await createBooking(
          daniel.id,
          courtB,
          '2026-11-01T10:00:00Z',
          '2026-11-01T11:00:00Z',
        ),
        dCancelled: await createBooking(
          daniel.id,
          courtA,
          '2026-11-04T10:00:00Z',
          '2026-11-04T11:00:00Z',
          '2026-11-01T09:00:00Z',
        ),
      };
    });

    const idsOf = (bookings: Booking[]) => bookings.map((b) => b.id);

    it('lists upcoming and in-progress bookings soonest first', async () => {
      const upcoming = await listMine(maria.token, '?scope=upcoming');

      expect(idsOf(upcoming)).toEqual([
        ids.mStartsNow,
        ids.mTomorrow,
        ids.mLater,
      ]);
      expect(upcoming.map((b) => b.status)).toEqual([
        'in_progress',
        'upcoming',
        'upcoming',
      ]);
    });

    it('lists completed and cancelled bookings by start, newest first', async () => {
      const past = await listMine(maria.token, '?scope=past');

      // The cancelled booking starts in the future and still sorts first (D-088).
      expect(idsOf(past)).toEqual([
        ids.mCancelled,
        ids.mEndsNow,
        ids.mYesterday,
        ids.mInactive,
      ]);
      expect(past.map((b) => b.status)).toEqual([
        'cancelled',
        'completed',
        'completed',
        'completed',
      ]);
    });

    it('splits all of the user bookings between the two lists, none twice', async () => {
      const upcoming = idsOf(await listMine(maria.token, '?scope=upcoming'));
      const past = idsOf(await listMine(maria.token, '?scope=past'));

      const mine = await prisma.booking.findMany({
        where: { userId: maria.id },
      });
      expect([...upcoming, ...past].sort()).toEqual(
        mine.map((row) => row.id).sort(),
      );
    });

    it('defaults to the upcoming list', async () => {
      const withoutScope = await listMine(maria.token);
      const upcoming = await listMine(maria.token, '?scope=upcoming');

      expect(withoutScope).toEqual(upcoming);
    });

    it('breaks a tie in the start time by court name', async () => {
      // Created in the opposite order to the names.
      const onB = await createBooking(
        maria.id,
        courtB,
        '2026-11-20T12:00:00Z',
        '2026-11-20T13:00:00Z',
      );
      const onA = await createBooking(
        maria.id,
        courtA,
        '2026-11-20T12:00:00Z',
        '2026-11-20T13:00:00Z',
      );

      const upcoming = await listMine(maria.token, '?scope=upcoming');

      expect(idsOf(upcoming).slice(-2)).toEqual([onA, onB]);
    });

    it('breaks a tie in the start time by court name in the past list too', async () => {
      // Created in the opposite order to the names.
      const onB = await createBooking(
        maria.id,
        courtB,
        '2026-10-25T12:00:00Z',
        '2026-10-25T13:00:00Z',
      );
      const onA = await createBooking(
        maria.id,
        courtA,
        '2026-10-25T12:00:00Z',
        '2026-10-25T13:00:00Z',
      );

      const past = await listMine(maria.token, '?scope=past');

      // Past is newest first; only the tie-break is ascending (D-088).
      expect(idsOf(past).slice(-3)).toEqual([onA, onB, ids.mInactive]);
    });

    it('shows each user only their own bookings, in both lists', async () => {
      const danielLists = {
        upcoming: await listMine(daniel.token, '?scope=upcoming'),
        past: await listMine(daniel.token, '?scope=past'),
      };

      expect(idsOf(danielLists.upcoming)).toEqual([ids.dTomorrow]);
      expect(idsOf(danielLists.past)).toEqual([ids.dCancelled, ids.dYesterday]);

      const mariaIds = [
        ...idsOf(await listMine(maria.token, '?scope=upcoming')),
        ...idsOf(await listMine(maria.token, '?scope=past')),
      ];
      expect(mariaIds).not.toContain(ids.dTomorrow);
      expect(mariaIds).not.toContain(ids.dYesterday);
      expect(mariaIds).not.toContain(ids.dCancelled);
    });

    it('gives an admin an empty list: only their own bookings, no role exception', async () => {
      expect(await listMine(admin.token, '?scope=upcoming')).toEqual([]);
      expect(await listMine(admin.token, '?scope=past')).toEqual([]);
    });

    it('returns exactly the contract keys and no user data', async () => {
      const response = await get(
        '/api/bookings/mine?scope=upcoming',
        maria.token,
      ).expect(200);

      const items = response.body as Record<string, unknown>[];
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(Object.keys(item).sort()).toEqual(
          Object.keys(bookingSchema.shape).sort(),
        );
        expect(Object.keys(item.court as object).sort()).toEqual([
          'id',
          'name',
          'sportType',
        ]);
      }
    });

    it('rejects an unknown scope with 400 VALIDATION_FAILED', async () => {
      const response = await get(
        '/api/bookings/mine?scope=bogus',
        maria.token,
      ).expect(400);

      expect(errorResponseSchema.parse(response.body).code).toBe(
        'VALIDATION_FAILED',
      );
    });

    it('returns 401 without a token', async () => {
      const response = await get('/api/bookings/mine', null).expect(401);

      expect(errorResponseSchema.parse(response.body).code).toBe(
        'UNAUTHENTICATED',
      );
    });
  });

  describe('cancelling', () => {
    // Maria's booking on court A, 14:00 to 15:00Z. Cancellable up to and
    // including 12:00:00.000Z.
    const STARTS_AT = '2026-11-02T14:00:00.000Z';
    const WINDOW_CLOSES = '2026-11-02T12:00:00.000Z';
    const WINDOW_MESSAGE =
      'Bookings can only be cancelled up to 2 hours before they start';
    let bookingId: string;

    beforeEach(async () => {
      bookingId = await createBooking(
        maria.id,
        courtA,
        STARTS_AT,
        '2026-11-02T15:00:00.000Z',
      );
    });

    const cancel = (id: string, bearer: string | null = maria.token) => {
      const call = request(app.getHttpServer()).post(
        `/api/bookings/${id}/cancel`,
      );
      return bearer ? call.set('Authorization', `Bearer ${bearer}`) : call;
    };

    const storedCancelledAt = async () =>
      (await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } }))
        .cancelledAt;

    const errorOf = (body: unknown) => errorResponseSchema.parse(body);

    it('cancels with 200 and returns the cancelled booking', async () => {
      const response = await cancel(bookingId).expect(200);

      const body = bookingSchema.parse(response.body);
      expect(body).toMatchObject({
        id: bookingId,
        status: 'cancelled',
        canCancel: false,
        cancelledAt: '2026-11-02T10:00:00.000Z',
        startsAt: STARTS_AT,
        cancellableUntil: WINDOW_CLOSES,
      });
      expect(Object.keys(response.body as object).sort()).toEqual(
        Object.keys(bookingSchema.shape).sort(),
      );
      expect((await storedCancelledAt())?.toISOString()).toBe(
        '2026-11-02T10:00:00.000Z',
      );
    });

    it('cancels at exactly two hours before the start, stamped with the clock', async () => {
      clock.set(WINDOW_CLOSES);

      const response = await cancel(bookingId).expect(200);

      expect(response.body).toMatchObject({
        status: 'cancelled',
        cancelledAt: WINDOW_CLOSES,
      });
      expect((await storedCancelledAt())?.toISOString()).toBe(WINDOW_CLOSES);
    });

    it('cancels one millisecond before the window closes', async () => {
      clock.set('2026-11-02T11:59:59.999Z');

      await cancel(bookingId).expect(200);
    });

    it('refuses one millisecond after the window closed and leaves the row alone', async () => {
      clock.set('2026-11-02T12:00:00.001Z');

      const response = await cancel(bookingId).expect(422);

      expect(errorOf(response.body)).toMatchObject({
        code: 'CANCELLATION_WINDOW_CLOSED',
        message: WINDOW_MESSAGE,
      });
      expect(await storedCancelledAt()).toBeNull();
    });

    it('refuses a booking that is in progress', async () => {
      clock.set('2026-11-02T14:30:00.000Z');

      const response = await cancel(bookingId).expect(422);

      expect(errorOf(response.body)).toMatchObject({
        code: 'CANCELLATION_WINDOW_CLOSED',
        message: WINDOW_MESSAGE,
      });
      expect(await storedCancelledAt()).toBeNull();
    });

    it('refuses a booking at exactly its end, when it is completed', async () => {
      clock.set('2026-11-02T15:00:00.000Z');

      const response = await cancel(bookingId).expect(422);

      expect(errorOf(response.body)).toMatchObject({
        code: 'CANCELLATION_WINDOW_CLOSED',
        message: WINDOW_MESSAGE,
      });
      expect(await storedCancelledAt()).toBeNull();
    });

    it('refuses a second cancel with 409 and keeps the first cancelledAt', async () => {
      await cancel(bookingId).expect(200);
      clock.set('2026-11-02T10:30:00.000Z');

      const response = await cancel(bookingId).expect(409);

      expect(errorOf(response.body).code).toBe('ALREADY_CANCELLED');
      expect((await storedCancelledAt())?.toISOString()).toBe(
        '2026-11-02T10:00:00.000Z',
      );
    });

    it.each([
      ['inside the window', '2026-11-02T11:00:00.000Z'],
      ['after the window closed', '2026-11-02T13:00:00.000Z'],
      ['after the booking ended', '2026-11-02T16:00:00.000Z'],
    ])(
      'reports an already cancelled booking as 409, not 422, %s',
      async (_label, now) => {
        await prisma.booking.update({
          where: { id: bookingId },
          data: { cancelledAt: '2026-11-01T09:00:00.000Z' },
        });
        clock.set(now);

        const response = await cancel(bookingId).expect(409);

        expect(errorOf(response.body).code).toBe('ALREADY_CANCELLED');
      },
    );

    it.each([
      ['another user', () => daniel.token],
      ['an admin', () => admin.token],
    ])(
      'answers %s with the same 404 as an unknown id and changes nothing',
      async (_label, bearer) => {
        const unknown = await cancel(randomUUID()).expect(404);

        const response = await cancel(bookingId, bearer()).expect(404);

        expect(errorOf(response.body).code).toBe('NOT_FOUND');
        expect(response.body).toEqual(unknown.body);
        expect(await storedCancelledAt()).toBeNull();
      },
    );

    it('rejects a malformed id with 400 and details for id', async () => {
      const response = await cancel('not-a-uuid').expect(400);

      const body = errorOf(response.body);
      expect(body.code).toBe('VALIDATION_FAILED');
      expect(body.details?.map((detail) => detail.path)).toEqual(['id']);
    });

    it('cancels a future booking on a deactivated court', async () => {
      const onInactive = await createBooking(
        maria.id,
        courtS,
        '2026-11-05T14:00:00.000Z',
        '2026-11-05T15:00:00.000Z',
      );

      const response = await cancel(onInactive).expect(200);

      expect(response.body).toMatchObject({ status: 'cancelled' });
    });

    it('frees the slot for someone else', async () => {
      const book = () =>
        request(app.getHttpServer())
          .post('/api/bookings')
          .set('Authorization', `Bearer ${daniel.token}`)
          .send({ courtId: courtA, startsAt: STARTS_AT, hours: 1 });

      const taken = await book().expect(409);
      expect(errorOf(taken.body).code).toBe('SLOT_TAKEN');

      await cancel(bookingId).expect(200);

      await book().expect(201);
    });

    // A concurrency smoke test: exactly one of ten simultaneous cancels wins.
    // It does not prove the cancelledAt: null condition on the update, because
    // the earlier checks serialise these requests in practice. The next test
    // proves that condition.
    it('ten parallel cancels: one 200, nine 409 ALREADY_CANCELLED', async () => {
      const responses = await Promise.all(
        Array.from({ length: 10 }, () => cancel(bookingId)),
      );

      const statuses = responses.map((response) => response.status);
      expect(statuses.filter((status) => status === 200)).toHaveLength(1);
      expect(statuses.filter((status) => status === 409)).toHaveLength(9);
      for (const response of responses.filter((r) => r.status === 409)) {
        expect(errorOf(response.body).code).toBe('ALREADY_CANCELLED');
      }
      expect((await storedCancelledAt())?.toISOString()).toBe(
        '2026-11-02T10:00:00.000Z',
      );
    });

    // Reaches the count === 0 branch deterministically: another cancel lands
    // after this request has read the booking and before its update runs.
    it('answers 409 and keeps the other cancelledAt when a cancel lands between the read and the update', async () => {
      const otherCancelledAt = '2026-11-02T09:30:00.000Z';
      const findFirst = prisma.booking.findFirst.bind(prisma.booking);
      const spy = jest
        .spyOn(prisma.booking, 'findFirst')
        .mockImplementationOnce(async (args) => {
          const stale = await findFirst(args);
          await prisma.booking.update({
            where: { id: bookingId },
            data: { cancelledAt: otherCancelledAt },
          });
          return stale;
        });

      try {
        const response = await cancel(bookingId).expect(409);

        expect(spy).toHaveBeenCalledTimes(1);
        expect(errorOf(response.body).code).toBe('ALREADY_CANCELLED');
        expect((await storedCancelledAt())?.toISOString()).toBe(
          otherCancelledAt,
        );
      } finally {
        spy.mockRestore();
      }
    });

    it('returns 401 without a token', async () => {
      const response = await cancel(bookingId, null).expect(401);

      expect(errorOf(response.body).code).toBe('UNAUTHENTICATED');
      expect(await storedCancelledAt()).toBeNull();
    });
  });
});
