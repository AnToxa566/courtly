import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Opt-out from the global JwtAuthGuard. Used for login and for health only.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
