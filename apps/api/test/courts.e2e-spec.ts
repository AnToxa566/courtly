import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import {
  courtSchema,
  errorResponseSchema,
  type CreateCourtRequest,
} from '@courtly/contracts';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { PrismaService } from './../src/prisma/prisma.service';

describe('Courts (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let userToken: string;
  let adminToken: string;
  let userId: string;
  // Created out of order on purpose: the API must sort them by name.
  let alphaId: string;
  let closedId: string;

  const newCourt: CreateCourtRequest = {
    name: 'Echo',
    sportType: 'TENNIS',
    pricePerHourCents: 3000,
    opensAt: '09:00',
    closesAt: '21:00',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.$executeRaw`TRUNCATE TABLE "Booking", "Court", "User" CASCADE`;
    const user = await prisma.user.create({
      data: {
        email: 'maria@courtly.test',
        passwordHash: 'not used: tokens are signed directly',
        name: 'Maria Kovacs',
      },
    });
    const admin = await prisma.user.create({
      data: {
        email: 'admin@courtly.test',
        passwordHash: 'not used: tokens are signed directly',
        name: 'Admin',
        role: 'ADMIN',
      },
    });
    userId = user.id;
    const jwt = app.get(JwtService);
    userToken = jwt.sign({ sub: user.id });
    adminToken = jwt.sign({ sub: admin.id });

    const court = (name: string, isActive: boolean) =>
      prisma.court.create({
        data: {
          name,
          sportType: 'PADEL',
          pricePerHourCents: 2000,
          opensAtMinutes: 480,
          closesAtMinutes: 1320,
          isActive,
        },
      });
    await court('Bravo', true);
    alphaId = (await court('Alpha', true)).id;
    await court('Charlie', true);
    closedId = (await court('Delta', false)).id;
  });

  const get = (path: string, token?: string) => {
    const call = request(app.getHttpServer()).get(`/api${path}`);
    return token ? call.set('Authorization', `Bearer ${token}`) : call;
  };

  const send = (
    method: 'post' | 'patch',
    path: string,
    body: object,
    token?: string,
  ) => {
    const call = request(app.getHttpServer())[method](`/api${path}`).send(body);
    return token ? call.set('Authorization', `Bearer ${token}`) : call;
  };

  const allCourtRows = () => prisma.court.findMany({ orderBy: { id: 'asc' } });

  describe('user routes', () => {
    it('lists only active courts, sorted by name, with only the contract keys', async () => {
      const response = await get('/courts', userToken).expect(200);

      const courts = courtSchema.array().parse(response.body);
      expect(courts.map((court) => court.name)).toEqual([
        'Alpha',
        'Bravo',
        'Charlie',
      ]);
      for (const body of response.body as object[]) {
        expect(Object.keys(body).sort()).toEqual(
          Object.keys(courtSchema.shape).sort(),
        );
      }
      expect(courts[0]).toMatchObject({ opensAt: '08:00', closesAt: '22:00' });
    });

    it('returns one active court', async () => {
      const response = await get(`/courts/${alphaId}`, userToken).expect(200);

      expect(courtSchema.parse(response.body)).toMatchObject({
        id: alphaId,
        name: 'Alpha',
      });
    });

    it.each([
      ['an inactive court', () => closedId],
      ['an unknown id', () => randomUUID()],
    ])('answers 404 for %s', async (_name, id) => {
      const response = await get(`/courts/${id()}`, userToken).expect(404);

      expect(errorResponseSchema.parse(response.body).code).toBe('NOT_FOUND');
    });

    it('answers 400 with an id detail for an id that is not a UUID', async () => {
      const response = await get('/courts/not-a-uuid', userToken).expect(400);

      const body = errorResponseSchema.parse(response.body);
      expect(body.code).toBe('VALIDATION_FAILED');
      expect(body.details?.map((detail) => detail.path)).toEqual(['id']);
    });

    it('requires a token', async () => {
      await get('/courts').expect(401);
      await get(`/courts/${alphaId}`).expect(401);
    });
  });

  describe('admin routes are closed to everyone but admins', () => {
    const routes = [
      ['GET', () => get('/admin/courts', userToken), 'list'],
      [
        'POST',
        () => send('post', '/admin/courts', newCourt, userToken),
        'create',
      ],
      [
        'PATCH',
        () =>
          send(
            'patch',
            `/admin/courts/${alphaId}`,
            { pricePerHourCents: 9999 },
            userToken,
          ),
        'update',
      ],
    ] as const;
    const withoutToken = {
      GET: () => get('/admin/courts'),
      POST: () => send('post', '/admin/courts', newCourt),
      PATCH: () =>
        send('patch', `/admin/courts/${alphaId}`, { pricePerHourCents: 9999 }),
    };

    it.each(routes)('%s is 403 for a user', async (_method, call) => {
      const before = await allCourtRows();

      const response = await call().expect(403);

      expect(errorResponseSchema.parse(response.body).code).toBe('FORBIDDEN');
      expect(await allCourtRows()).toEqual(before);
    });

    it.each(routes)('%s is 401 without a token', async (method) => {
      const before = await allCourtRows();

      await withoutToken[method]().expect(401);

      expect(await allCourtRows()).toEqual(before);
    });
  });

  describe('POST /api/admin/courts', () => {
    it('creates a court and returns it in the contract shape', async () => {
      const response = await send(
        'post',
        '/admin/courts',
        newCourt,
        adminToken,
      ).expect(201);

      const court = courtSchema.parse(response.body);
      expect(court).toMatchObject({ ...newCourt, isActive: true });
      const row = await prisma.court.findUniqueOrThrow({
        where: { id: court.id },
      });
      expect(row).toMatchObject({ opensAtMinutes: 540, closesAtMinutes: 1260 });
    });

    it('accepts closing at 24:00, stored as 1440', async () => {
      const response = await send(
        'post',
        '/admin/courts',
        { ...newCourt, closesAt: '24:00' },
        adminToken,
      ).expect(201);

      const court = courtSchema.parse(response.body);
      expect(court.closesAt).toBe('24:00');
      const row = await prisma.court.findUniqueOrThrow({
        where: { id: court.id },
      });
      expect(row.closesAtMinutes).toBe(1440);
    });

    it('rejects a closing time before the opening time', async () => {
      const response = await send(
        'post',
        '/admin/courts',
        { ...newCourt, opensAt: '22:00', closesAt: '08:00' },
        adminToken,
      ).expect(400);

      const body = errorResponseSchema.parse(response.body);
      expect(body.details?.map((detail) => detail.path)).toEqual(['closesAt']);
    });

    it('rejects a price of zero', async () => {
      const before = await prisma.court.count();

      await send(
        'post',
        '/admin/courts',
        { ...newCourt, pricePerHourCents: 0 },
        adminToken,
      ).expect(400);

      expect(await prisma.court.count()).toBe(before);
    });
  });

  describe('PATCH /api/admin/courts/:id', () => {
    const patch = (id: string, body: object) =>
      send('patch', `/admin/courts/${id}`, body, adminToken);

    it('validates a one-sided change against the stored court', async () => {
      // Alpha closes at 22:00, so opening at 23:00 leaves it with no hours.
      const createError = await send(
        'post',
        '/admin/courts',
        { ...newCourt, opensAt: '23:00', closesAt: '22:00' },
        adminToken,
      ).expect(400);
      const before = await allCourtRows();

      const response = await patch(alphaId, { opensAt: '23:00' }).expect(400);

      const body = errorResponseSchema.parse(response.body);
      expect(body.code).toBe('VALIDATION_FAILED');
      expect(body.details).toEqual(
        errorResponseSchema.parse(createError.body).details,
      );
      expect(await allCourtRows()).toEqual(before);
    });

    it('rejects an empty patch', async () => {
      const response = await patch(alphaId, {}).expect(400);

      expect(errorResponseSchema.parse(response.body).code).toBe(
        'VALIDATION_FAILED',
      );
    });

    it('answers 404 for an unknown court', async () => {
      const response = await patch(randomUUID(), {
        pricePerHourCents: 2500,
      }).expect(404);

      expect(errorResponseSchema.parse(response.body).code).toBe('NOT_FOUND');
    });

    it('changes only the fields in the patch', async () => {
      const before = await prisma.court.findUniqueOrThrow({
        where: { id: alphaId },
      });

      const response = await patch(alphaId, {
        pricePerHourCents: 2500,
      }).expect(200);

      expect(courtSchema.parse(response.body).pricePerHourCents).toBe(2500);
      const after = await prisma.court.findUniqueOrThrow({
        where: { id: alphaId },
      });
      expect(after).toEqual({
        ...before,
        pricePerHourCents: 2500,
        updatedAt: after.updatedAt,
      });
    });
  });

  describe('deactivating a court', () => {
    it('hides it from users, keeps it for admins and keeps its bookings', async () => {
      const hour = 60 * 60 * 1000;
      const first = new Date('2026-11-02T10:00:00Z');
      for (const startsAt of [first, new Date(first.getTime() + 3 * hour)]) {
        await prisma.booking.create({
          data: {
            userId,
            courtId: alphaId,
            startsAt,
            endsAt: new Date(startsAt.getTime() + hour),
            totalPriceCents: 2000,
          },
        });
      }
      const bookingsBefore = await prisma.booking.count();

      await send(
        'patch',
        `/admin/courts/${alphaId}`,
        { isActive: false },
        adminToken,
      ).expect(200);

      expect(await prisma.booking.count()).toBe(bookingsBefore);
      const userList = await get('/courts', userToken).expect(200);
      expect(
        courtSchema
          .array()
          .parse(userList.body)
          .map((court) => court.name),
      ).toEqual(['Bravo', 'Charlie']);
      const adminList = await get('/admin/courts', adminToken).expect(200);
      expect(
        courtSchema
          .array()
          .parse(adminList.body)
          .map((court) => [court.name, court.isActive]),
      ).toEqual([
        ['Bravo', true],
        ['Charlie', true],
        ['Alpha', false],
        ['Delta', false],
      ]);

      await send(
        'patch',
        `/admin/courts/${alphaId}`,
        { isActive: true },
        adminToken,
      ).expect(200);

      const restored = await get('/courts', userToken).expect(200);
      expect(
        courtSchema
          .array()
          .parse(restored.body)
          .map((court) => court.name),
      ).toEqual(['Alpha', 'Bravo', 'Charlie']);
    });
  });
});
