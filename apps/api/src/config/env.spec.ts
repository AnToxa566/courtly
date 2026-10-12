import { validateEnv } from './env';

describe('validateEnv', () => {
  const valid = {
    DATABASE_URL: 'postgresql://courtly:courtly@localhost:5432/courtly',
    FACILITY_TIMEZONE: 'Europe/Lisbon',
    JWT_SECRET: 'x'.repeat(32),
  };

  it('returns the parsed values when every variable is valid', () => {
    expect(validateEnv(valid)).toEqual(valid);
  });

  it('throws naming DATABASE_URL when it is missing', () => {
    expect(() => validateEnv({ ...valid, DATABASE_URL: undefined })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('throws naming DATABASE_URL when it is empty', () => {
    expect(() => validateEnv({ ...valid, DATABASE_URL: '' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('throws naming FACILITY_TIMEZONE when it is missing', () => {
    expect(() =>
      validateEnv({ ...valid, FACILITY_TIMEZONE: undefined }),
    ).toThrow(/FACILITY_TIMEZONE/);
  });

  it('throws naming FACILITY_TIMEZONE when it is not an IANA zone', () => {
    expect(() =>
      validateEnv({ ...valid, FACILITY_TIMEZONE: 'Not/AZone' }),
    ).toThrow(/FACILITY_TIMEZONE/);
  });

  it('throws naming JWT_SECRET when it is missing', () => {
    expect(() => validateEnv({ ...valid, JWT_SECRET: undefined })).toThrow(
      /JWT_SECRET/,
    );
  });

  it('throws naming JWT_SECRET when it is empty', () => {
    expect(() => validateEnv({ ...valid, JWT_SECRET: '' })).toThrow(
      /JWT_SECRET/,
    );
  });

  it('rejects a JWT_SECRET of 31 characters', () => {
    expect(() => validateEnv({ ...valid, JWT_SECRET: 'x'.repeat(31) })).toThrow(
      /JWT_SECRET/,
    );
  });

  it('accepts a JWT_SECRET of exactly 32 characters', () => {
    expect(validateEnv({ ...valid, JWT_SECRET: 'x'.repeat(32) })).toEqual({
      ...valid,
      JWT_SECRET: 'x'.repeat(32),
    });
  });

  it('does not echo the JWT_SECRET value in the error', () => {
    const tooShort = 'short-but-recognisable';
    let message = '';
    try {
      validateEnv({ ...valid, JWT_SECRET: tooShort });
    } catch (error) {
      message = error instanceof Error ? error.message : '';
    }

    expect(message).toMatch(/JWT_SECRET/);
    expect(message).not.toContain(tooShort);
  });
});
