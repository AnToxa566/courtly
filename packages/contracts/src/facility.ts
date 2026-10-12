import { z } from 'zod';
import { localDateSchema } from './common';

export const facilitySchema = z.object({
  timezone: z.string(),
  today: localDateSchema,
  cancellationWindowHours: z.int().positive(),
  maxBookingHours: z.int().positive(),
});
export type Facility = z.infer<typeof facilitySchema>;
