import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatDayHeading, formatDayLabel, formatPrice } from './format';

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
  },
);
