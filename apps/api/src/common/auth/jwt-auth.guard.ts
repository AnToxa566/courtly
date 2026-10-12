import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@courtly/contracts';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiException } from '../errors/api.exception';
import type { AuthenticatedRequest } from './current-user.decorator';
import { IS_PUBLIC_KEY } from './public.decorator';

// The only claim read from a token. A value that is not a UUID is rejected
// here, so it can never reach the database as a malformed id.
const tokenPayloadSchema = z.object({ sub: z.uuid() });

// Global guard, runs before RolesGuard. Authenticates every route that is not
// marked @Public().
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.authenticate(request.headers.authorization);
    if (!user) {
      throw new ApiException('UNAUTHENTICATED', 'Authentication is required');
    }
    request.user = user;
    return true;
  }

  // Returns null for any reason the caller is not signed in, so the caller
  // cannot tell a bad signature from a deleted user.
  private async authenticate(header: string | undefined): Promise<User | null> {
    const [scheme, token, ...rest] = header?.split(' ') ?? [];
    if (scheme?.toLowerCase() !== 'bearer' || !token || rest.length > 0) {
      return null;
    }

    let payload: unknown;
    try {
      payload = await this.jwt.verifyAsync<object>(token);
    } catch {
      return null;
    }
    const claims = tokenPayloadSchema.safeParse(payload);
    if (!claims.success) {
      return null;
    }

    // The role comes from this row, not from the token.
    return this.prisma.user.findUnique({
      where: { id: claims.data.sub },
      select: { id: true, name: true, email: true, role: true },
    });
  }
}
