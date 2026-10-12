import { z } from 'zod';
import { userSchema } from './auth';
import { bookingSchema } from './bookings';
import { centsSchema, localDateSchema } from './common';

export const adminBookingSchema = bookingSchema.extend({
  user: userSchema.pick({ id: true, name: true, email: true }),
});
export type AdminBooking = z.infer<typeof adminBookingSchema>;

export const adminDayQuerySchema = z.object({
  date: localDateSchema.optional(),
});
export type AdminDayQuery = z.input<typeof adminDayQuerySchema>;

export const adminDaySchema = z.object({
  date: localDateSchema,
  totalRevenueCents: centsSchema,
  bookingCount: z.int(),
  bookings: z.array(adminBookingSchema),
});
export type AdminDay = z.infer<typeof adminDaySchema>;
