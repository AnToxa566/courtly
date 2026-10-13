import { DateTime } from 'luxon';
import { Clock } from './../src/common/time/clock';

// A clock tests can move. Provide it with overrideProvider(Clock).
export class FixedClock extends Clock {
  private instant: DateTime;

  constructor(iso: string) {
    super();
    this.instant = FixedClock.parse(iso);
  }

  now(): DateTime {
    return this.instant;
  }

  set(iso: string): void {
    this.instant = FixedClock.parse(iso);
  }

  private static parse(iso: string): DateTime {
    const instant = DateTime.fromISO(iso, { zone: 'utc' });
    if (!instant.isValid) {
      throw new Error(`FixedClock: "${iso}" is not an ISO instant`);
    }
    return instant;
  }
}
