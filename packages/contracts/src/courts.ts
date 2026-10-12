import { z } from 'zod';
import { centsSchema, idSchema, sportTypeSchema } from './common';

// Whole hours only, because slots are hourly. The time of day is 00:00 to
// 23:00 for opening and 01:00 to 24:00 for closing.
const opensAtSchema = z.string().regex(/^([01]\d|2[0-3]):00$/);
const closesAtSchema = z.string().regex(/^(0[1-9]|1\d|2[0-4]):00$/);

export const courtSchema = z.object({
  id: idSchema,
  name: z.string(),
  sportType: sportTypeSchema,
  pricePerHourCents: centsSchema,
  opensAt: opensAtSchema,
  closesAt: closesAtSchema,
  isActive: z.boolean(),
});
export type Court = z.infer<typeof courtSchema>;

// Not refined, because .partial() throws on a refined object.
const courtFieldsSchema = z.object({
  name: z.string().trim().min(1).max(60),
  sportType: sportTypeSchema,
  pricePerHourCents: z.int().positive(),
  opensAt: opensAtSchema,
  closesAt: closesAtSchema,
});

// String comparison is correct because both values are zero-padded "HH:00".
export const createCourtRequestSchema = courtFieldsSchema.refine(
  (court) => court.opensAt < court.closesAt,
  { message: 'closesAt must be after opensAt', path: ['closesAt'] },
);
export type CreateCourtRequest = z.input<typeof createCourtRequestSchema>;

// The order is checked here only when both times are present. When one is
// missing, the courts service validates the result of merging with the stored court.
export const updateCourtRequestSchema = courtFieldsSchema
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .refine(
    (update) => Object.values(update).some((value) => value !== undefined),
    {
      message: 'At least one field is required',
    },
  )
  .refine(
    (update) =>
      update.opensAt === undefined ||
      update.closesAt === undefined ||
      update.opensAt < update.closesAt,
    { message: 'closesAt must be after opensAt', path: ['closesAt'] },
  );
export type UpdateCourtRequest = z.input<typeof updateCourtRequestSchema>;
