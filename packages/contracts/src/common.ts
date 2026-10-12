import { z } from 'zod';

// Wire formats, defined once and reused by every schema.

// UTC only: an offset or a missing Z is rejected.
export const instantSchema = z.iso.datetime();
// YYYY-MM-DD, a real calendar date.
export const localDateSchema = z.iso.date();
// HH:mm, 00:00 to 23:59. A booking that ends at midnight has endTime "00:00".
export const localTimeSchema = z.iso.time({ precision: -1 });
export const centsSchema = z.int().nonnegative();
export const idSchema = z.uuid();

// These repeat the Prisma enums on purpose: contracts cannot import the
// generated client. apps/api/src/contracts-sync.spec.ts fails if they differ.
export const roleSchema = z.enum(['USER', 'ADMIN']);
export type Role = z.infer<typeof roleSchema>;

export const sportTypeSchema = z.enum([
  'PADEL',
  'TENNIS',
  'SQUASH',
  'BADMINTON',
]);
export type SportType = z.infer<typeof sportTypeSchema>;
