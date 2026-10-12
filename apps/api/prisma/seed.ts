import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'bcrypt';
import { DateTime } from 'luxon';
import { validateEnv } from '../src/config/env';
import {
  Prisma,
  PrismaClient,
  Role,
  SportType,
} from '../src/generated/prisma/client';

const BCRYPT_ROUNDS = 12;
const DEMO_PASSWORD = 'courtly123';

const env = validateEnv(process.env);
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});

async function main(): Promise<void> {
  if ((await prisma.user.count()) > 0) {
    console.log('Seed skipped: users already exist.');
    return;
  }

  // The one place outside the Clock that reads the system time. The seed runs
  // from the command line, before any Nest application exists, and the demo
  // bookings are placed relative to today in the facility's time zone.
  const now = DateTime.now().setZone(env.FACILITY_TIMEZONE);
  const today = now.startOf('day');
  // Wall-clock hour on a facility-local day, so the seed stays correct across
  // daylight saving changes.
  const at = (dayOffset: number, hour: number): Date =>
    today.plus({ days: dayOffset }).set({ hour }).toJSDate();

  const passwordHash = await hash(DEMO_PASSWORD, BCRYPT_ROUNDS);

  await prisma.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        name: 'Courtly Admin',
        email: 'admin@courtly.test',
        passwordHash,
        role: Role.ADMIN,
      },
    });
    const maria = await tx.user.create({
      data: {
        name: 'Maria Kovacs',
        email: 'maria@courtly.test',
        passwordHash,
        role: Role.USER,
      },
    });
    const daniel = await tx.user.create({
      data: {
        name: 'Daniel Reis',
        email: 'daniel@courtly.test',
        passwordHash,
        role: Role.USER,
      },
    });

    const padel1 = await tx.court.create({
      data: {
        name: 'Padel court 1',
        sportType: SportType.PADEL,
        pricePerHourCents: 2000,
        opensAtMinutes: 7 * 60,
        closesAtMinutes: 22 * 60,
      },
    });
    const padel2 = await tx.court.create({
      data: {
        name: 'Padel court 2',
        sportType: SportType.PADEL,
        pricePerHourCents: 2400,
        opensAtMinutes: 8 * 60,
        closesAtMinutes: 23 * 60,
      },
    });
    const tennis = await tx.court.create({
      data: {
        name: 'Tennis court',
        sportType: SportType.TENNIS,
        pricePerHourCents: 3000,
        opensAtMinutes: 9 * 60,
        closesAtMinutes: 21 * 60,
      },
    });
    const squash = await tx.court.create({
      data: {
        name: 'Squash court',
        sportType: SportType.SQUASH,
        pricePerHourCents: 1600,
        opensAtMinutes: 10 * 60,
        closesAtMinutes: 20 * 60,
        isActive: false,
      },
    });

    const bookings = [
      { day: -7, from: 17, to: 18, court: squash, user: maria },
      { day: -1, from: 10, to: 12, court: padel1, user: maria },
      { day: -1, from: 18, to: 19, court: tennis, user: daniel },
      { day: 0, from: 20, to: 21, court: padel1, user: daniel },
      { day: 1, from: 9, to: 10, court: padel2, user: maria },
      { day: 1, from: 18, to: 20, court: padel2, user: daniel },
      {
        day: 1,
        from: 19,
        to: 20,
        court: tennis,
        user: maria,
        cancelledAt: now.toJSDate(),
      },
      { day: 2, from: 11, to: 12, court: tennis, user: daniel },
    ];
    for (const b of bookings) {
      await tx.booking.create({
        data: {
          userId: b.user.id,
          courtId: b.court.id,
          startsAt: at(b.day, b.from),
          endsAt: at(b.day, b.to),
          totalPriceCents: (b.to - b.from) * b.court.pricePerHourCents,
          cancelledAt: b.cancelledAt,
        },
      });
    }
  });

  console.log(
    `Seeded ${await prisma.user.count()} users, ${await prisma.court.count()} courts, ${await prisma.booking.count()} bookings.`,
  );
}

void main()
  .catch((error: unknown) => {
    // Never print the error object or its message: a failed Prisma create
    // includes its arguments in the message, which here contain passwordHash.
    const code =
      error instanceof Prisma.PrismaClientKnownRequestError
        ? ` (${error.code})`
        : '';
    const name = error instanceof Error ? error.name : 'Unknown error';
    console.error(`Seed failed: ${name}${code}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
