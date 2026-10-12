import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { User } from '@courtly/contracts';
import type { Request } from 'express';
import { ApiException } from '../errors/api.exception';

// JwtAuthGuard sets `user` from the database row, never from the token.
export type AuthenticatedRequest = Request & { user?: User };

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User => {
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    // Only reachable on a @Public() route, where no guard set a user.
    if (!user) {
      throw new ApiException('UNAUTHENTICATED', 'Authentication is required');
    }
    return user;
  },
);
