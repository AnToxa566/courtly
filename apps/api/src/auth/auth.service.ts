import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { LoginRequest, LoginResponse } from '@courtly/contracts';
import { compare } from 'bcrypt';
import { ApiException } from '../common/errors/api.exception';
import { PrismaService } from '../prisma/prisma.service';

// bcrypt hash (cost 12, same as the seed) of a random string nobody knows.
// An unknown email is compared against it, so the response takes as long as a
// wrong password and does not reveal which emails exist.
export const DUMMY_PASSWORD_HASH =
  '$2b$12$WFqgxOnlfUpS73.7lGQnF.YnO5NJjtwwMnvCbOO6kXXILWj4e6THK';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(request: LoginRequest): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: request.email.trim().toLowerCase() },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        passwordHash: true,
      },
    });

    const passwordMatches = await compare(
      request.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!user || !passwordMatches) {
      throw new ApiException(
        'INVALID_CREDENTIALS',
        'Incorrect email or password',
      );
    }

    // The token carries only the user id; the role is read per request.
    const accessToken = await this.jwt.signAsync({ sub: user.id });
    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
}
