import { idSchema } from '@courtly/contracts';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// The shape of a route param is an API detail, so it is not in contracts; the
// UUID format itself is, in idSchema. A malformed id is a 400 before any query.
export class IdParamDto extends createZodDto(z.object({ id: idSchema })) {}
