import { z } from 'zod';
import {
  centsSchema,
  idSchema,
  instantSchema,
  localDateSchema,
  localTimeSchema,
} from './common';

export const availabilityQuerySchema = z.object({
  date: localDateSchema.optional(),
});
export type AvailabilityQuery = z.input<typeof availabilityQuerySchema>;

export const slotStatusSchema = z.enum(['available', 'booked', 'past']);
export type SlotStatus = z.infer<typeof slotStatusSchema>;

export const slotSchema = z.object({
  startsAt: instantSchema,
  endsAt: instantSchema,
  startTime: localTimeSchema,
  status: slotStatusSchema,
});
export type Slot = z.infer<typeof slotSchema>;

export const availabilitySchema = z.object({
  courtId: idSchema,
  date: localDateSchema,
  pricePerHourCents: centsSchema,
  slots: z.array(slotSchema),
});
export type Availability = z.infer<typeof availabilitySchema>;
