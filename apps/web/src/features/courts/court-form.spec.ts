import { describe, expect, it } from 'vitest';
import { createCourtRequestSchema, type Court } from '@courtly/contracts';
import {
  CLOSES_AT_OPTIONS,
  OPENS_AT_OPTIONS,
  centsToPriceInput,
  courtFormErrorMap,
  courtFormSchema,
  courtToFormValues,
  mapServerErrors,
  parsePriceToCents,
  toCreateCourtRequest,
  toUpdateCourtRequest,
  type CourtFormValues,
} from './court-form';

const VALID: CourtFormValues = {
  name: 'Olive court',
  sportType: 'PADEL',
  price: '28',
  opensAt: '08:00',
  closesAt: '22:00',
  isActive: true,
};

// The first message per field, as the form shows them.
function errorsOf(overrides: Partial<CourtFormValues>) {
  const result = courtFormSchema.safeParse(
    { ...VALID, ...overrides },
    { error: courtFormErrorMap },
  );
  const errors: Record<string, string> = {};
  if (!result.success) {
    for (const issue of result.error.issues) {
      errors[String(issue.path[0])] ??= issue.message;
    }
  }
  return errors;
}

const STORED: Court = {
  id: '6f1c1f0e-5a53-4d1e-9a39-0d6a9f1a2b3c',
  name: 'Olive court',
  sportType: 'PADEL',
  pricePerHourCents: 2800,
  opensAt: '08:00',
  closesAt: '22:00',
  isActive: true,
};

describe('parsePriceToCents', () => {
  it.each([
    ['28', 2800],
    ['28.5', 2850],
    ['28.50', 2850],
    ['1.15', 115],
    ['19.99', 1999],
    ['0.05', 5],
    [' 28 ', 2800],
  ])('reads %j as %i cents', (input, cents) => {
    expect(parsePriceToCents(input)).toBe(cents);
  });

  it.each([
    '',
    '   ',
    '0',
    '0.00',
    '-5',
    'abc',
    '28,50',
    '1.155',
    '.5',
    '28.',
    '1e3',
  ])('rejects %j', (input) => {
    expect(parsePriceToCents(input)).toBeNull();
  });
});

describe('centsToPriceInput', () => {
  it.each([
    [2800, '28'],
    [2850, '28.50'],
    [115, '1.15'],
    [1999, '19.99'],
    [5, '0.05'],
  ])('prints %i cents as %j', (cents, text) => {
    expect(centsToPriceInput(cents)).toBe(text);
  });

  it('reads back what it printed', () => {
    for (const cents of [100, 115, 1999, 2850, 12345]) {
      expect(parsePriceToCents(centsToPriceInput(cents))).toBe(cents);
    }
  });
});

describe('courtFormSchema copy', () => {
  it('accepts a valid court', () => {
    expect(errorsOf({})).toEqual({});
  });

  it('asks for a name, also when it is only spaces', () => {
    expect(errorsOf({ name: '' }).name).toBe('Enter a court name.');
    expect(errorsOf({ name: '   ' }).name).toBe('Enter a court name.');
  });

  it('refuses a name longer than the contract allows', () => {
    expect(errorsOf({ name: 'x'.repeat(61) }).name).toBe(
      'Court name must be 60 characters or fewer.',
    );
  });

  it('asks for a sport', () => {
    expect(errorsOf({ sportType: undefined }).sportType).toBe(
      'Choose a sport.',
    );
  });

  it.each(['', '0', '0.00', '-3'])(
    'says the price must be more than zero for %j',
    (price) => {
      expect(errorsOf({ price }).price).toBe('Price must be more than €0.');
    },
  );

  it.each(['abc', '28,50', '1.155', '€28'])(
    'shows the price format for %j',
    (price) => {
      expect(errorsOf({ price }).price).toBe('Enter a price like 28 or 28.50.');
    },
  );

  it('puts the order message on closesAt', () => {
    expect(errorsOf({ opensAt: '22:00', closesAt: '08:00' })).toEqual({
      closesAt: 'Closing time must be after opening time.',
    });
    expect(errorsOf({ opensAt: '08:00', closesAt: '08:00' })).toEqual({
      closesAt: 'Closing time must be after opening time.',
    });
  });
});

describe('hour options', () => {
  it('opens at 00:00 to 23:00', () => {
    expect(OPENS_AT_OPTIONS).toHaveLength(24);
    expect(OPENS_AT_OPTIONS[0]).toBe('00:00');
    expect(OPENS_AT_OPTIONS[23]).toBe('23:00');
  });

  it('closes at 01:00 to 24:00', () => {
    expect(CLOSES_AT_OPTIONS).toHaveLength(24);
    expect(CLOSES_AT_OPTIONS[0]).toBe('01:00');
    expect(CLOSES_AT_OPTIONS[23]).toBe('24:00');
  });

  it('are all accepted by the contract', () => {
    for (const option of OPENS_AT_OPTIONS) {
      const result = createCourtRequestSchema.safeParse({
        ...toCreateCourtRequest(VALID),
        opensAt: option,
        closesAt: '24:00',
      });
      expect(result.success).toBe(true);
    }
    for (const option of CLOSES_AT_OPTIONS) {
      const result = createCourtRequestSchema.safeParse({
        ...toCreateCourtRequest(VALID),
        opensAt: '00:00',
        closesAt: option,
      });
      expect(result.success).toBe(true);
    }
  });

  it('agree with the contract on all 576 pairs', () => {
    let pairs = 0;
    for (const opensAt of OPENS_AT_OPTIONS) {
      for (const closesAt of CLOSES_AT_OPTIONS) {
        const values = { ...VALID, opensAt, closesAt };
        const form = courtFormSchema.safeParse(values).success;
        const contract = createCourtRequestSchema.safeParse(
          toCreateCourtRequest(values),
        ).success;
        expect(form, `${opensAt}-${closesAt}`).toBe(contract);
        pairs += 1;
      }
    }
    expect(pairs).toBe(576);
  });
});

describe('request builders', () => {
  it('builds a create request with trimmed name and price in cents', () => {
    expect(
      toCreateCourtRequest({ ...VALID, name: '  Olive court ', price: '28.5' }),
    ).toEqual({
      name: 'Olive court',
      sportType: 'PADEL',
      pricePerHourCents: 2850,
      opensAt: '08:00',
      closesAt: '22:00',
    });
  });

  it('turns a stored court into form values and back to no change', () => {
    const values = courtToFormValues(STORED);
    expect(values).toEqual(VALID);
    expect(toUpdateCourtRequest(STORED, values)).toEqual({});
  });

  it('sends only what changed', () => {
    expect(toUpdateCourtRequest(STORED, { ...VALID, price: '30' })).toEqual({
      pricePerHourCents: 3000,
    });
    expect(
      toUpdateCourtRequest(STORED, {
        ...VALID,
        name: 'Olive',
        closesAt: '23:00',
        isActive: false,
      }),
    ).toEqual({ name: 'Olive', closesAt: '23:00', isActive: false });
  });

  it('does not treat 28.00 as a change from 2800 cents', () => {
    expect(toUpdateCourtRequest(STORED, { ...VALID, price: '28.00' })).toEqual(
      {},
    );
  });
});

describe('mapServerErrors', () => {
  it('maps contract paths to form fields with the form copy', () => {
    expect(
      mapServerErrors([
        { path: 'pricePerHourCents', message: 'Too small' },
        { path: 'closesAt', message: 'closesAt must be after opensAt' },
        { path: 'name', message: 'Too small' },
        { path: 'sportType', message: 'Invalid option' },
      ]),
    ).toEqual({
      fields: {
        price: 'Price must be more than €0.',
        closesAt: 'Closing time must be after opening time.',
        name: 'Enter a court name.',
        sportType: 'Choose a sport.',
      },
      unmatched: [],
    });
  });

  it('keeps what it cannot place, with the server message', () => {
    expect(
      mapServerErrors([
        { path: '', message: 'At least one field is required' },
        { path: 'opensAt', message: 'Invalid string' },
      ]),
    ).toEqual({
      fields: {},
      unmatched: ['At least one field is required', 'Invalid string'],
    });
  });

  it('handles a response without details', () => {
    expect(mapServerErrors(undefined)).toEqual({ fields: {}, unmatched: [] });
  });
});
