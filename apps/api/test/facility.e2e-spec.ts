import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { errorResponseSchema, facilitySchema } from '@courtly/contracts';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { Clock } from './../src/common/time/clock';
import { PrismaService } from './../src/prisma/prisma.service';
import { FixedClock } from './fixed-clock';

describe('GET /api/facility (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;
  const clock = new FixedClock('2026-10-12T22:30:00Z');

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
    await prisma.$executeRaw`TRUNCATE TABLE "Booking", "Court", "User" CASCADE`;
    const user = await prisma.user.create({
      data: {
        email: 'maria@courtly.test',
        passwordHash: 'not used: the token is signed directly',
        name: 'Maria Kovacs',
      },
    });
    token = app.get(JwtService).sign({ sub: user.id });
  });

  afterAll(async () => {
    await app.close();
  });

  const getFacility = () =>
    request(app.getHttpServer())
      .get('/api/facility')
      .set('Authorization', `Bearer ${token}`);

  it("follows the facility's date, not UTC's, from the clock", async () => {
    clock.set('2026-10-12T22:30:00Z');
    const before = await getFacility().expect(200);

    expect(facilitySchema.parse(before.body)).toEqual({
      timezone: 'Europe/Lisbon',
      today: '2026-10-12',
      cancellationWindowHours: 2,
      maxBookingHours: 2,
    });

    // One hour later it is already the next day in Lisbon (UTC+1).
    clock.set('2026-10-12T23:30:00Z');
    const after = await getFacility().expect(200);

    expect(facilitySchema.parse(after.body).today).toBe('2026-10-13');
  });

  it('requires a token', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/facility')
      .expect(401);

    expect(errorResponseSchema.parse(response.body).code).toBe(
      'UNAUTHENTICATED',
    );
  });
});
