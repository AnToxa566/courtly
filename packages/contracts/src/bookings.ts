import { z } from 'zod';
import {
  centsSchema,
  idSchema,
  instantSchema,
  localDateSchema,
  localTimeSchema,
  sportTypeSchema,
} from './common';

export const createBookingRequestSchema = z.object({
  courtId: idSchema,
  startsAt: instantSchema,
  hours: z.literal([1, 2]),
});
export type CreateBookingRequest = z.input<typeof createBookingRequestSchema>;

export const myBookingsQuerySchema = z.object({
  scope: z.enum(['upcoming', 'past']).default('upcoming'),
});
export type MyBookingsQuery = z.input<typeof myBookingsQuerySchema>;

export const bookingStatusSchema = z.enum([
  'upcoming',
  'completed',
  'cancelled',
]);
export type BookingStatus = z.infer<typeof bookingStatusSchema>;

export const bookingSchema = z.object({
  id: idSchema,
  court: z.object({
    id: idSchema,
    name: z.string(),
    sportType: sportTypeSchema,
  }),
  startsAt: instantSchema,
  endsAt: instantSchema,
  date: localDateSchema,
  startTime: localTimeSchema,
  endTime: localTimeSchema,
  hours: z.int(),
  totalPriceCents: centsSchema,
  status: bookingStatusSchema,
  canCancel: z.boolean(),
  cancellableUntil: instantSchema,
  cancelledAt: instantSchema.nullable(),
});
export type Booking = z.infer<typeof bookingSchema>;
