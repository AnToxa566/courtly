import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcrypt';
import { ApiException } from '../common/errors/api.exception';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService, DUMMY_PASSWORD_HASH } from './auth.service';

describe('AuthService', () => {
  const findUnique = jest.fn();
  const signAsync = jest.fn();
  let service: AuthService;
  let compareSpy: jest.SpyInstance;
  let storedHash: string;

  beforeAll(async () => {
    // Cost 4 keeps the suite fast; the cost of the dummy hash is tested apart.
    storedHash = await bcrypt.hash('courtly123', 4);
  });

  beforeEach(async () => {
    findUnique.mockReset();
    signAsync.mockReset().mockResolvedValue('signed-token');
    compareSpy = jest.spyOn(bcrypt, 'compare');
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: { user: { findUnique } } },
        { provide: JwtService, useValue: { signAsync } },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const maria = () => ({
    id: '3f2b8a52-6c1e-4b8e-9f43-1a2b3c4d5e6f',
    name: 'Maria Kovacs',
    email: 'maria@courtly.test',
    role: 'USER',
    passwordHash: storedHash,
  });

  it('uses a dummy hash with the same cost as the seeded hashes', () => {
    expect(bcrypt.getRounds(DUMMY_PASSWORD_HASH)).toBe(12);
  });

  it('returns a token and exactly the four user fields', async () => {
    findUnique.mockResolvedValue(maria());

    const result = await service.login({
      email: 'maria@courtly.test',
      password: 'courtly123',
    });

    expect(result).toEqual({
      accessToken: 'signed-token',
      user: {
        id: maria().id,
        name: 'Maria Kovacs',
        email: 'maria@courtly.test',
        role: 'USER',
      },
    });
    expect(signAsync).toHaveBeenCalledWith({ sub: maria().id });
  });

  it('looks the email up trimmed and in lower case', async () => {
    findUnique.mockResolvedValue(maria());

    await service.login({
      email: '  Maria@Courtly.TEST ',
      password: 'courtly123',
    });

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'maria@courtly.test' } }),
    );
  });

  it('still runs bcrypt.compare for an unknown email', async () => {
    findUnique.mockResolvedValue(null);

    await expect(
      service.login({ email: 'nobody@courtly.test', password: 'whatever' }),
    ).rejects.toBeInstanceOf(ApiException);

    expect(compareSpy).toHaveBeenCalledWith('whatever', DUMMY_PASSWORD_HASH);
  });

  it('gives the same response for an unknown email and a wrong password', async () => {
    findUnique.mockResolvedValueOnce(null);
    const unknownEmail: unknown = await service
      .login({ email: 'nobody@courtly.test', password: 'wrong' })
      .catch((error: unknown) => error);
    findUnique.mockResolvedValueOnce(maria());
    const wrongPassword: unknown = await service
      .login({ email: 'maria@courtly.test', password: 'wrong' })
      .catch((error: unknown) => error);

    expect(unknownEmail).toBeInstanceOf(ApiException);
    expect(wrongPassword).toBeInstanceOf(ApiException);
    if (
      !(unknownEmail instanceof ApiException) ||
      !(wrongPassword instanceof ApiException)
    ) {
      return;
    }
    expect(unknownEmail.getStatus()).toBe(401);
    expect(unknownEmail.code).toBe('INVALID_CREDENTIALS');
    expect(unknownEmail.getStatus()).toBe(wrongPassword.getStatus());
    expect(unknownEmail.getResponse()).toEqual(wrongPassword.getResponse());
    expect(signAsync).not.toHaveBeenCalled();
  });
});
