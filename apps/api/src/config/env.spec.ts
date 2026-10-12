import { validateEnv } from './env';

describe('validateEnv', () => {
  const valid = {
    DATABASE_URL: 'postgresql://courtly:courtly@localhost:5432/courtly',
    FACILITY_TIMEZONE: 'Europe/Lisbon',
  };

  it('returns the parsed values when both variables are valid', () => {
    expect(validateEnv(valid)).toEqual(valid);
  });

  it('throws naming DATABASE_URL when it is missing', () => {
    expect(() =>
      validateEnv({ FACILITY_TIMEZONE: valid.FACILITY_TIMEZONE }),
    ).toThrow(/DATABASE_URL/);
  });

  it('throws naming DATABASE_URL when it is empty', () => {
    expect(() => validateEnv({ ...valid, DATABASE_URL: '' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('throws naming FACILITY_TIMEZONE when it is missing', () => {
    expect(() => validateEnv({ DATABASE_URL: valid.DATABASE_URL })).toThrow(
      /FACILITY_TIMEZONE/,
    );
  });

  it('throws naming FACILITY_TIMEZONE when it is not an IANA zone', () => {
    expect(() =>
      validateEnv({ ...valid, FACILITY_TIMEZONE: 'Not/AZone' }),
    ).toThrow(/FACILITY_TIMEZONE/);
  });
});
