import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import {
  adminBookingSchema,
  createBookingRequestSchema,
  createCourtRequestSchema,
  errorCodeSchema,
  myBookingsQuerySchema,
  roleSchema,
  sportTypeSchema,
  updateCourtRequestSchema,
  userSchema,
} from '@courtly/contracts';
// The enums file holds plain constants. Importing the client instead would
// load the query compiler with a dynamic import() that plain Jest rejects.
import { Role, SportType } from './generated/prisma/enums';

const court = {
  name: 'Court 1',
  sportType: 'PADEL',
  pricePerHourCents: 2000,
  opensAt: '08:00',
  closesAt: '23:00',
};

const booking = {
  courtId: '3f2b8a52-6c1e-4b8e-9f43-1a2b3c4d5e6f',
  startsAt: '2026-11-02T10:00:00Z',
  hours: 1,
};

describe('contracts stay in sync with the rest of the repository', () => {
  it('repeats the Prisma enums exactly', () => {
    expect(roleSchema.options).toEqual(Object.values(Role));
    expect(sportTypeSchema.options).toEqual(Object.values(SportType));
  });

  describe('court opening hours', () => {
    it('accepts a closing time of 24:00', () => {
      expect(
        createCourtRequestSchema.safeParse({ ...court, closesAt: '24:00' })
          .success,
      ).toBe(true);
    });

    it.each([
      ['closesAt is not on the hour', { closesAt: '23:30' }],
      ['opensAt is 24:00', { opensAt: '24:00' }],
      ['opensAt equals closesAt', { opensAt: '10:00', closesAt: '10:00' }],
    ])('rejects it when %s', (_name, change) => {
      expect(
        createCourtRequestSchema.safeParse({ ...court, ...change }).success,
      ).toBe(false);
    });

    it('reports an inverted range on the closesAt path', () => {
      const result = createCourtRequestSchema.safeParse({
        ...court,
        opensAt: '10:00',
        closesAt: '09:00',
      });

      expect(result.success).toBe(false);
      expect(result.error?.issues).toHaveLength(1);
      expect(result.error?.issues[0]).toMatchObject({
        code: 'custom',
        path: ['closesAt'],
      });
    });
  });

  describe('create booking request', () => {
    // The upper bound is policy, enforced by the bookings service and tested
    // in bookings.e2e-spec.ts.
    it.each([0, 1.5])('rejects %d hours', (hours) => {
      expect(
        createBookingRequestSchema.safeParse({ ...booking, hours }).success,
      ).toBe(false);
    });

    it.each(['2026-11-02T10:00:00', '2026-11-02T10:00:00+01:00'])(
      'rejects startsAt %s',
      (startsAt) => {
        expect(
          createBookingRequestSchema.safeParse({ ...booking, startsAt })
            .success,
        ).toBe(false);
      },
    );

    it('accepts a valid request', () => {
      expect(createBookingRequestSchema.safeParse(booking).success).toBe(true);
    });
  });

  it('rejects an empty court update', () => {
    expect(updateCourtRequestSchema.safeParse({}).success).toBe(false);
  });

  it('defaults the scope of my bookings to upcoming', () => {
    expect(myBookingsQuerySchema.parse({})).toEqual({ scope: 'upcoming' });
  });

  describe('error codes are documented', () => {
    // Read from the file so the document and the code cannot drift apart.
    const architecture = readFileSync(
      join(__dirname, '../../../docs/ARCHITECTURE.md'),
      'utf8',
    );
    const start = architecture.search(/^## API$/m);
    const section = architecture.slice(start);
    const end = section.slice(1).search(/^## /m);
    const documented = [
      ...section
        .slice(0, end === -1 ? undefined : end + 1)
        .matchAll(/^\|\s*(\d{3})\s*\|\s*`?([A-Z_]+)`?\s*\|/gm),
    ].map((match) => match[2]);

    it('finds the API section', () => {
      expect(start).toBeGreaterThanOrEqual(0);
      expect(documented.length).toBeGreaterThan(0);
    });

    it.each(errorCodeSchema.options)('lists %s', (code) => {
      expect(documented).toContain(code);
    });
  });

  it('keeps passwords out of the user and admin booking schemas', () => {
    // toJSONSchema walks nested objects, so a leaked key anywhere would show.
    expect(JSON.stringify(z.toJSONSchema(userSchema))).not.toMatch(/password/i);
    expect(JSON.stringify(z.toJSONSchema(adminBookingSchema))).not.toMatch(
      /password/i,
    );
  });
});
