import { SetMetadata } from '@nestjs/common';
import type { Role } from '@courtly/contracts';

export const ROLES_KEY = 'roles';

// Read by the global RolesGuard. A route without it needs only a signed-in user.
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
