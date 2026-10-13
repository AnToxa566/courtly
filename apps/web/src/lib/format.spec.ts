import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatDayHeading,
  formatDayLabel,
  formatDayTile,
  formatDayWithYear,
  formatHours,
  formatPrice,
  formatTime,
} from './format';

describe('formatPrice', () => {
  it('prints whole euros without decimals', () => {
    expect(formatPrice(2400)).toBe('€24');
    expect(formatPrice(0)).toBe('€0');
  });

  it('prints two decimals when there are cents', () => {
    expect(formatPrice(2850)).toBe('€28.50');
    expect(formatPrice(2805)).toBe('€28.05');
    expect(formatPrice(99)).toBe('€0.99');
  });
});

describe('formatHours', () => {
  it('uses the singular for one hour', () => {
    expect(formatHours(1)).toBe('1 hour');
    expect(formatHours(2)).toBe('2 hours');
  });
});

// The browser can be in any zone. These two are the extremes: on 9 Oct a
// local-time implementation would print the 8th or the 10th in one of them.
describe.each(['Pacific/Kiritimati', 'Pacific/Pago_Pago'])(
  'day formatting with the browser in %s',
  (zone) => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('really runs in that zone', () => {
      vi.stubEnv('TZ', zone);
      expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(zone);
    });

    it('labels a day', () => {
      vi.stubEnv('TZ', zone);
      expect(formatDayLabel('2026-10-09', '2026-10-01')).toBe('Fri 9 Oct');
    });

    it('marks the facility today', () => {
      vi.stubEnv('TZ', zone);
      expect(formatDayLabel('2026-10-09', '2026-10-09')).toBe(
        'Today, Fri 9 Oct',
      );
    });

    it('writes a heading', () => {
      vi.stubEnv('TZ', zone);
      expect(formatDayHeading('2026-10-09')).toBe('Friday 9 October');
    });

    it('writes a date with the year', () => {
      vi.stubEnv('TZ', zone);
      expect(formatDayWithYear('2026-10-09')).toBe('Fri 9 Oct 2026');
      expect(formatDayWithYear('2027-01-01')).toBe('Fri 1 Jan 2027');
    });

    it('names a date-strip tile', () => {
      vi.stubEnv('TZ', zone);
      expect(formatDayTile('2026-10-10')).toEqual({ weekday: 'Sat', day: 10 });
    });

    it('prints a slot time in the facility zone, not the browser zone', () => {
      vi.stubEnv('TZ', zone);
      // 14:00 UTC is 15:00 in Lisbon in summer time (WEST).
      expect(formatTime('2026-10-09T14:00:00.000Z', 'Europe/Lisbon')).toBe(
        '15:00',
      );
    });

    it('prints midnight as 00:00', () => {
      vi.stubEnv('TZ', zone);
      // 23:00 UTC on the 24th is midnight in Lisbon on the 25th (WEST).
      expect(formatTime('2026-10-24T23:00:00.000Z', 'Europe/Lisbon')).toBe(
        '00:00',
      );
    });

    // Lisbon's clocks go back at 01:00 on 25 October 2026, so 01:00 happens
    // twice. The two instants print the same; the app keys slots by instant.
    it('prints the two 01:00 slots of 25 October 2026 the same', () => {
      vi.stubEnv('TZ', zone);
      expect(formatTime('2026-10-25T00:00:00.000Z', 'Europe/Lisbon')).toBe(
        '01:00',
      );
      expect(formatTime('2026-10-25T01:00:00.000Z', 'Europe/Lisbon')).toBe(
        '01:00',
      );
      expect(formatTime('2026-10-25T02:00:00.000Z', 'Europe/Lisbon')).toBe(
        '02:00',
      );
    });
  },
);
