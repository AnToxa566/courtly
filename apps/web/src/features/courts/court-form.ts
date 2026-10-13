import { z } from 'zod';
import {
  createCourtRequestSchema,
  type Court,
  type CreateCourtRequest,
  type ErrorResponse,
  type UpdateCourtRequest,
} from '@courtly/contracts';

// The form works in strings and whole hours; the API takes cents. Everything
// here is pure so it can be tested without a DOM.

const NAME_REQUIRED = 'Enter a court name.';
const NAME_TOO_LONG = 'Court name must be 60 characters or fewer.';
const SPORT_REQUIRED = 'Choose a sport.';
const PRICE_FORMAT = 'Enter a price like 28 or 28.50.';
const PRICE_POSITIVE = 'Price must be more than €0.';
const CLOSES_AFTER_OPENS = 'Closing time must be after opening time.';

const hour = (h: number) => `${String(h).padStart(2, '0')}:00`;
// 00:00 to 23:00, and 01:00 to 24:00. The contract's regexes accept the same.
export const OPENS_AT_OPTIONS = Array.from({ length: 24 }, (_, h) => hour(h));
export const CLOSES_AT_OPTIONS = Array.from({ length: 24 }, (_, h) =>
  hour(h + 1),
);

const PRICE_PATTERN = /^(\d+)(?:\.(\d{1,2}))?$/;

// "28.50" -> 2850. Done on the digits, because 1.15 * 100 is 114.99999999999999.
export function parsePriceToCents(input: string): number | null {
  const match = PRICE_PATTERN.exec(input.trim());
  if (!match) return null;
  const cents = Number(match[1] + (match[2] ?? '').padEnd(2, '0'));
  return cents > 0 ? cents : null;
}

export function centsToPriceInput(cents: number): string {
  const euros = Math.floor(cents / 100);
  const rest = cents % 100;
  return rest === 0
    ? String(euros)
    : `${euros}.${String(rest).padStart(2, '0')}`;
}

// The contract's fields are the single definition of what a court is. Its
// request schema is refined, and a refined object cannot be .omit()ed, so the
// form starts from the bare shape.
export const courtFormSchema = z
  .object(createCourtRequestSchema.shape)
  .omit({ pricePerHourCents: true })
  .extend({
    price: z.string().refine((text) => parsePriceToCents(text) !== null),
    isActive: z.boolean(),
  })
  .refine((court) => court.opensAt < court.closesAt, {
    path: ['closesAt'],
  });
export type CourtFormValues = z.infer<typeof courtFormSchema>;

// The contract carries no user-facing copy, so the form's copy is attached
// by field. Zod hands over the raw issue, which still has the input.
export function courtFormErrorMap(
  issue: z.core.$ZodRawIssue,
): string | undefined {
  switch (issue.path?.[0]) {
    case 'name':
      return issue.code === 'too_big' ? NAME_TOO_LONG : NAME_REQUIRED;
    case 'sportType':
      return SPORT_REQUIRED;
    case 'price': {
      // An empty, zero or negative amount is a number that is too small;
      // anything else is not a price at all.
      const text = typeof issue.input === 'string' ? issue.input.trim() : '';
      return text === '' || /^-?\d+(\.\d{1,2})?$/.test(text)
        ? PRICE_POSITIVE
        : PRICE_FORMAT;
    }
    case 'closesAt':
      return issue.code === 'custom' ? CLOSES_AFTER_OPENS : undefined;
    default:
      return undefined;
  }
}

export function courtToFormValues(court: Court): CourtFormValues {
  return {
    name: court.name,
    sportType: court.sportType,
    price: centsToPriceInput(court.pricePerHourCents),
    opensAt: court.opensAt,
    closesAt: court.closesAt,
    isActive: court.isActive,
  };
}

// The price is validated before this runs; null here is a bug.
function priceInCents(values: CourtFormValues): number {
  const cents = parsePriceToCents(values.price);
  if (cents === null) {
    throw new Error('The price was not validated before it was converted.');
  }
  return cents;
}

export function toCreateCourtRequest(
  values: CourtFormValues,
): CreateCourtRequest {
  return {
    name: values.name.trim(),
    sportType: values.sportType,
    pricePerHourCents: priceInCents(values),
    opensAt: values.opensAt,
    closesAt: values.closesAt,
  };
}

// Only the fields that differ from the stored court. The server then merges
// the patch with the stored court and checks the hours on the result.
export function toUpdateCourtRequest(
  court: Court,
  values: CourtFormValues,
): UpdateCourtRequest {
  const patch: UpdateCourtRequest = {};
  const name = values.name.trim();
  const pricePerHourCents = priceInCents(values);
  if (name !== court.name) patch.name = name;
  if (values.sportType !== court.sportType) patch.sportType = values.sportType;
  if (pricePerHourCents !== court.pricePerHourCents) {
    patch.pricePerHourCents = pricePerHourCents;
  }
  if (values.opensAt !== court.opensAt) patch.opensAt = values.opensAt;
  if (values.closesAt !== court.closesAt) patch.closesAt = values.closesAt;
  if (values.isActive !== court.isActive) patch.isActive = values.isActive;
  return patch;
}

type FormField = keyof CourtFormValues;

// Server paths are contract field names. A server 400 for one of these shows
// the form's copy for the field; anything else is kept for a banner.
const SERVER_FIELDS = new Map<string, { field: FormField; copy: string }>([
  ['name', { field: 'name', copy: NAME_REQUIRED }],
  ['sportType', { field: 'sportType', copy: SPORT_REQUIRED }],
  ['pricePerHourCents', { field: 'price', copy: PRICE_POSITIVE }],
  ['closesAt', { field: 'closesAt', copy: CLOSES_AFTER_OPENS }],
]);

export function mapServerErrors(details: ErrorResponse['details']): {
  fields: Partial<Record<FormField, string>>;
  unmatched: string[];
} {
  const fields: Partial<Record<FormField, string>> = {};
  const unmatched: string[] = [];
  for (const { path, message } of details ?? []) {
    const target = SERVER_FIELDS.get(path);
    if (target) {
      fields[target.field] = target.copy;
    } else {
      unmatched.push(message);
    }
  }
  return { fields, unmatched };
}
