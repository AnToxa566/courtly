import { afterEach, describe, expect, it, vi } from 'vitest';
import { TZDate } from 'react-day-picker';
import { addDays, fromCalendarDate, toCalendarDate } from './local-date';

describe('addDays', () => {
  it('steps within a month', () => {
    expect(addDays('2026-10-09', 1)).toBe('2026-10-10');
    expect(addDays('2026-10-09', 6)).toBe('2026-10-15');
    expect(addDays('2026-10-09', 0)).toBe('2026-10-09');
  });

  it('rolls over a month and a year', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('steps backwards', () => {
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
  });

  // A day is a label here, not 24 hours: the clocks changing in Lisbon on
  // 25 October 2026 (25 hours) and 28 March 2027 (23 hours) change nothing.
  it('steps across the days the clocks change', () => {
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(addDays('2027-03-27', 1)).toBe('2027-03-28');
    expect(addDays('2027-03-28', 1)).toBe('2027-03-29');
  });
});

// The browser can be in any zone. These two are the extremes: a local-time
// implementation would shift the date by a day in one of them.
describe.each(['Pacific/Kiritimati', 'Pacific/Pago_Pago'])(
  'calendar dates with the browser in %s',
  (zone) => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('really runs in that zone', () => {
      vi.stubEnv('TZ', zone);
      expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(zone);
    });

    it.each(['2026-10-09', '2026-10-25', '2027-03-28', '2026-12-31'])(
      'gives %s back after a round trip',
      (localDate) => {
        vi.stubEnv('TZ', zone);
        expect(fromCalendarDate(toCalendarDate(localDate))).toBe(localDate);
      },
    );

    it('steps a day', () => {
      vi.stubEnv('TZ', zone);
      expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
    });

    // What the Calendar hands to onSelect when it runs with timeZone="UTC".
    it('reads the day the Calendar returns', () => {
      vi.stubEnv('TZ', zone);
      const clicked = new TZDate(toCalendarDate('2026-10-25'), 'UTC');
      expect(fromCalendarDate(clicked)).toBe('2026-10-25');
    });
  },
);
