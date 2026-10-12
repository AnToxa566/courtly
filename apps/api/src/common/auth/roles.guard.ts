import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@courtly/contracts';
import { ApiException } from '../errors/api.exception';
import type { AuthenticatedRequest } from './current-user.decorator';
import { ROLES_KEY } from './roles.decorator';

// Global guard, registered after JwtAuthGuard so `request.user` is set.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles) {
      return true;
    }

    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user || !roles.includes(user.role)) {
      throw new ApiException('FORBIDDEN', 'You are not allowed to do this');
    }
    return true;
  }
}
