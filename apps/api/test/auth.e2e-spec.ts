import { Controller, Get, INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { errorResponseSchema, loginResponseSchema } from '@courtly/contracts';
import { hash } from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { Roles } from './../src/common/auth/roles.decorator';
import { PrismaService } from './../src/prisma/prisma.service';

// Routes that only exist in this test. `open` carries no decorator at all, so
// it shows that a route is protected by default; `admin` exercises RolesGuard
// before any real admin route is built.
@Controller('probe')
class ProbeController {
  @Get('open')
  open(): { ok: true } {
    return { ok: true };
  }

  @Get('admin')
  @Roles('ADMIN')
  admin(): { ok: true } {
    return { ok: true };
  }
}

describe('Auth and the error envelope (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;
  let secret: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProbeController],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);

    // Loaded from .env.test by load-test-env.ts.
    const configured = process.env.JWT_SECRET;
    if (!configured) {
      throw new Error('JWT_SECRET is not set in .env.test');
    }
    secret = configured;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.$executeRaw`TRUNCATE TABLE "Booking", "Court", "User" CASCADE`;
    const user = await prisma.user.create({
      data: {
        email: 'maria@courtly.test',
        // Cost 4 keeps the suite fast; the API itself only compares.
        passwordHash: await hash('courtly123', 4),
        name: 'Maria Kovacs',
      },
    });
    userId = user.id;
  });

  const me = (authorization?: string) => {
    const call = request(app.getHttpServer()).get('/api/auth/me');
    return authorization ? call.set('Authorization', authorization) : call;
  };

  const expectUnauthenticated = async (
    authorization?: string,
  ): Promise<void> => {
    const response = await me(authorization).expect(401);

    expect(errorResponseSchema.parse(response.body)).toMatchObject({
      statusCode: 401,
      code: 'UNAUTHENTICATED',
    });
  };

  it('renders an unknown route as a 404 in the error envelope', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/nope')
      .expect(404);

    expect(errorResponseSchema.parse(response.body)).toEqual({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Not found',
    });
  });

  it('renders malformed JSON as VALIDATION_FAILED without details', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/nope')
      .set('Content-Type', 'application/json')
      .send('{"email":')
      .expect(400);

    const body = errorResponseSchema.parse(response.body);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.details).toBeUndefined();
  });

  describe('POST /api/auth/login', () => {
    const login = (body: object) =>
      request(app.getHttpServer()).post('/api/auth/login').send(body);

    it('returns a token and exactly the four user fields', async () => {
      const response = await login({
        email: 'maria@courtly.test',
        password: 'courtly123',
      }).expect(200);

      const body = loginResponseSchema.parse(response.body);
      expect(Object.keys(response.body as object).sort()).toEqual([
        'accessToken',
        'user',
      ]);
      expect(body.user).toEqual({
        id: userId,
        name: 'Maria Kovacs',
        email: 'maria@courtly.test',
        role: 'USER',
      });
      expect(JSON.stringify(response.body)).not.toContain('passwordHash');
      expect(JSON.stringify(response.body)).not.toContain('$2b$');
    });

    it('issues a token with only sub, iat and exp, valid for 8 hours', async () => {
      const response = await login({
        email: 'maria@courtly.test',
        password: 'courtly123',
      }).expect(200);

      const claims = jwt.decode<{ sub: string; iat: number; exp: number }>(
        loginResponseSchema.parse(response.body).accessToken,
      );
      expect(Object.keys(claims).sort()).toEqual(['exp', 'iat', 'sub']);
      expect(claims.sub).toBe(userId);
      expect(claims.exp - claims.iat).toBe(8 * 60 * 60);
    });

    it('lets the token from login call /api/auth/me', async () => {
      const response = await login({
        email: 'maria@courtly.test',
        password: 'courtly123',
      }).expect(200);

      await me(`Bearer ${loginResponseSchema.parse(response.body).accessToken}`)
        .expect(200)
        .expect(({ body }) => expect(body).toMatchObject({ id: userId }));
    });

    it('accepts the email in upper case', async () => {
      await login({
        email: 'MARIA@Courtly.TEST',
        password: 'courtly123',
      }).expect(200);
    });

    it('answers an unknown email and a wrong password identically', async () => {
      const unknownEmail = await login({
        email: 'nobody@courtly.test',
        password: 'courtly123',
      }).expect(401);
      const wrongPassword = await login({
        email: 'maria@courtly.test',
        password: 'not-the-password',
      }).expect(401);

      expect(errorResponseSchema.parse(unknownEmail.body).code).toBe(
        'INVALID_CREDENTIALS',
      );
      expect(unknownEmail.body).toEqual(wrongPassword.body);
    });

    it('rejects an invalid body with VALIDATION_FAILED and its paths', async () => {
      const response = await login({ email: 'nope' }).expect(400);

      const body = errorResponseSchema.parse(response.body);
      expect(body.code).toBe('VALIDATION_FAILED');
      expect(body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: 'email' }),
          expect.objectContaining({ path: 'password' }),
        ]),
      );
    });
  });

  describe('authentication guard', () => {
    it('rejects a request with no Authorization header', () =>
      expectUnauthenticated());

    it('protects a route that has no decorators at all', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/probe/open')
        .expect(401);

      expect(errorResponseSchema.parse(response.body).code).toBe(
        'UNAUTHENTICATED',
      );

      await request(app.getHttpServer())
        .get('/api/probe/open')
        .set('Authorization', `Bearer ${jwt.sign({ sub: userId })}`)
        .expect(200);
    });

    it.each([
      'Bearer',
      'Bearer ',
      'Bearer not-a-jwt',
      'Basic dXNlcjpwYXNz',
      'Bearer two tokens',
    ])('rejects the malformed header %j', (header) =>
      expectUnauthenticated(header),
    );

    it('rejects a token signed with another secret', async () => {
      const forged = new JwtService({
        secret: 'another-secret-that-is-longer-than-32-chars',
      }).sign({ sub: userId });

      await expectUnauthenticated(`Bearer ${forged}`);
    });

    it('rejects a token signed with another algorithm', async () => {
      const other = new JwtService({
        secret,
        signOptions: { algorithm: 'HS512' },
      }).sign({ sub: userId });

      await expectUnauthenticated(`Bearer ${other}`);
    });

    it('rejects an expired token', async () => {
      // exp: 1 is January 1970. A fresh service has no expiresIn option, which
      // would conflict with an exp already in the payload.
      const expired = new JwtService({ secret }).sign({
        sub: userId,
        exp: 1,
      });

      await expectUnauthenticated(`Bearer ${expired}`);
    });

    it('rejects a sub that is not a UUID with a 401, not a 500', async () => {
      await expectUnauthenticated(
        `Bearer ${jwt.sign({ sub: "1'; DROP TABLE users" })}`,
      );
    });

    it('rejects a token for a user that was deleted', async () => {
      const token = jwt.sign({ sub: userId });
      await prisma.user.delete({ where: { id: userId } });

      await expectUnauthenticated(`Bearer ${token}`);
    });

    it('returns exactly the four user fields for a valid token', async () => {
      const response = await me(`Bearer ${jwt.sign({ sub: userId })}`).expect(
        200,
      );

      expect(response.body).toEqual({
        id: userId,
        name: 'Maria Kovacs',
        email: 'maria@courtly.test',
        role: 'USER',
      });
    });
  });

  describe('roles guard', () => {
    const probe = (authorization?: string) => {
      const call = request(app.getHttpServer()).get('/api/probe/admin');
      return authorization ? call.set('Authorization', authorization) : call;
    };

    it('answers 401, not 403, when there is no token', async () => {
      const response = await probe().expect(401);

      expect(errorResponseSchema.parse(response.body).code).toBe(
        'UNAUTHENTICATED',
      );
    });

    it('follows the role in the database, not the one at issue time', async () => {
      const header = `Bearer ${jwt.sign({ sub: userId })}`;

      const forbidden = await probe(header).expect(403);
      expect(errorResponseSchema.parse(forbidden.body).code).toBe('FORBIDDEN');

      await prisma.user.update({
        where: { id: userId },
        data: { role: 'ADMIN' },
      });
      await probe(header).expect(200);

      await prisma.user.update({
        where: { id: userId },
        data: { role: 'USER' },
      });
      await probe(header).expect(403);
    });
  });
});
