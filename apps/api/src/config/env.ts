import { IANAZone } from 'luxon';
import { z } from 'zod';

// No defaults: a missing value must stop the process at boot, not fall back
// silently. Empty strings are rejected too, because ConfigModule lets an
// empty variable in the process environment win over the value in .env.
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  FACILITY_TIMEZONE: z.string().refine((zone) => IANAZone.isValidZone(zone), {
    message: 'must be a valid IANA time zone, for example Europe/Lisbon',
  }),
  // 32 characters is the floor for an HS256 key. The message Zod produces
  // names the rule, never the value.
  JWT_SECRET: z.string().min(32),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment: ${problems}`);
  }
  return result.data;
}
