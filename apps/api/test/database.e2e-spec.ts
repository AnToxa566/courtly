import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { validateEnv } from '../src/config/env';
import { PrismaModule } from '../src/prisma/prisma.module';
import { isBookingOverlapError } from '../src/prisma/prisma-errors';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Database invariants (e2e)', () => {
  let prisma: PrismaService;
  let userId: string;
  let courtId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
        PrismaModule,
      ],
    }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRaw`TRUNCATE TABLE "Booking", "Court", "User" CASCADE`;
    const user = await prisma.user.create({
      data: { email: 'a@courtly.test', passwordHash: 'x', name: 'A' },
    });
    const court = await prisma.court.create({
      data: {
        name: 'Padel court 1',
        sportType: 'PADEL',
        pricePerHourCents: 2000,
        opensAtMinutes: 420,
        closesAtMinutes: 1320,
      },
    });
    userId = user.id;
    courtId = court.id;
  });

  const book = (startsAt: string, endsAt: string, forCourtId = courtId) =>
    prisma.booking.create({
      data: {
        userId,
        courtId: forCourtId,
        startsAt,
        endsAt,
        totalPriceCents: 2000,
      },
    });

  it('ten parallel bookings for one slot: one fulfilled, nine rejected', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        book('2026-11-02T16:00:00.000Z', '2026-11-02T17:00:00.000Z'),
      ),
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(9);
    for (const result of rejected) {
      expect(isBookingOverlapError(result.reason)).toBe(true);
    }
    expect(await prisma.booking.count()).toBe(1);
  });

  it('allows adjacent bookings: 16-17 and 17-18 on the same court', async () => {
    await book('2026-11-02T16:00:00.000Z', '2026-11-02T17:00:00.000Z');
    await book('2026-11-02T17:00:00.000Z', '2026-11-02T18:00:00.000Z');

    expect(await prisma.booking.count()).toBe(2);
  });

  it('allows the same range on a different court', async () => {
    const other = await prisma.court.create({
      data: {
        name: 'Padel court 2',
        sportType: 'PADEL',
        pricePerHourCents: 2400,
        opensAtMinutes: 480,
        closesAtMinutes: 1380,
      },
    });
    await book('2026-11-02T16:00:00.000Z', '2026-11-02T17:00:00.000Z');
    await book(
      '2026-11-02T16:00:00.000Z',
      '2026-11-02T17:00:00.000Z',
      other.id,
    );

    expect(await prisma.booking.count()).toBe(2);
  });

  it('rejects a partially overlapping range with the overlap error', async () => {
    await book('2026-11-02T16:00:00.000Z', '2026-11-02T18:00:00.000Z');

    const error: unknown = await book(
      '2026-11-02T17:00:00.000Z',
      '2026-11-02T19:00:00.000Z',
    ).catch((e: unknown) => e);

    expect(isBookingOverlapError(error)).toBe(true);
  });

  it('frees the slot once the booking is cancelled', async () => {
    const first = await book(
      '2026-11-02T16:00:00.000Z',
      '2026-11-02T17:00:00.000Z',
    );
    await prisma.booking.update({
      where: { id: first.id },
      data: { cancelledAt: '2026-11-01T10:00:00.000Z' },
    });

    await book('2026-11-02T16:00:00.000Z', '2026-11-02T17:00:00.000Z');

    expect(await prisma.booking.count()).toBe(2);
  });

  it('rejects endsAt <= startsAt with booking_time_order, not the overlap error', async () => {
    const attempt = book(
      '2026-11-02T17:00:00.000Z',
      '2026-11-02T16:00:00.000Z',
    );

    await expect(attempt).rejects.toThrow(/booking_time_order/);
    const error: unknown = await attempt.catch((e: unknown) => e);
    expect(isBookingOverlapError(error)).toBe(false);
  });

  it('rejects a court whose opening hours are not well formed', async () => {
    await expect(
      prisma.court.create({
        data: {
          name: 'Bad hours',
          sportType: 'TENNIS',
          pricePerHourCents: 3000,
          opensAtMinutes: 600,
          closesAtMinutes: 600,
        },
      }),
    ).rejects.toThrow(/court_hours_valid/);
  });

  it('rejects a court with a non-positive price', async () => {
    await expect(
      prisma.court.create({
        data: {
          name: 'Free court',
          sportType: 'TENNIS',
          pricePerHourCents: 0,
          opensAtMinutes: 540,
          closesAtMinutes: 1260,
        },
      }),
    ).rejects.toThrow(/court_price_positive/);
  });

  it('refuses to delete a court that has bookings', async () => {
    await book('2026-11-02T16:00:00.000Z', '2026-11-02T17:00:00.000Z');

    await expect(
      prisma.court.delete({ where: { id: courtId } }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('has the booking_no_overlap exclusion constraint in pg_constraint', async () => {
    const rows = await prisma.$queryRaw<{ conname: string }[]>`
      SELECT conname FROM pg_constraint
      WHERE conname = 'booking_no_overlap' AND contype = 'x'
    `;

    expect(rows).toHaveLength(1);
  });
});
